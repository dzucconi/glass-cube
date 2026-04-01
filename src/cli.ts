#!/usr/bin/env node
import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import readline from "readline";
import { createAggregator } from "./aggregator";
import { diffSchemas } from "./schemaDiff";
import { schemaNodeToJSONSchema, schemaNodeToTypeScript } from "./schemaIR";

export type OutputFormat = "runtype" | "jsonschema" | "typescript" | "diff";

export interface InferCLIOptions {
  inputPath: string;
  comparePath?: string;
  outputPath?: string;
  format: OutputFormat;
  requiredFieldThreshold?: number;
  nullHandling?: "preserve" | "missing";
}

const LINE_DELIMITED_EXTENSIONS = new Set([".ndjson", ".jsonl"]);

const helpText = `Usage: glass-cube --input <path> [options]

Options:
  --input <path>                 Input file (.json, .jsonl, .ndjson)
  --out <path>                   Output path (defaults to stdout)
  --compare <path>               Baseline file for --format diff
  --format <runtype|jsonschema|typescript|diff>
                                 Output format (default: runtype)
  --required-threshold <0..1>    Field requiredness threshold (default: 1)
  --null-handling <preserve|missing>
                                 Null behavior (default: preserve)
  --help                         Show this help
`;

const parseFormat = (value?: string): OutputFormat => {
  if (!value || value === "runtype") return "runtype";
  if (value === "jsonschema") return "jsonschema";
  if (value === "typescript") return "typescript";
  if (value === "diff") return "diff";
  throw new Error(`Unsupported --format value: ${value}`);
};

const parseNullHandling = (
  value?: string
): "preserve" | "missing" | undefined => {
  if (!value) return undefined;
  if (value === "preserve" || value === "missing") return value;
  throw new Error(`Unsupported --null-handling value: ${value}`);
};

const parseRequiredThreshold = (value?: string): number | undefined => {
  if (!value) return undefined;
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid --required-threshold value: ${value}`);
  }

  return parsed;
};

export const parseCLIArgs = (argv: string[]): InferCLIOptions => {
  const args = [...argv];
  const get = (flag: string) => {
    const index = args.indexOf(flag);
    if (index === -1) return undefined;
    return args[index + 1];
  };

  const inputPath = get("--input");

  if (!inputPath) {
    throw new Error("Missing required --input <path>");
  }

  return {
    inputPath,
    comparePath: get("--compare"),
    outputPath: get("--out"),
    format: parseFormat(get("--format")),
    requiredFieldThreshold: parseRequiredThreshold(get("--required-threshold")),
    nullHandling: parseNullHandling(get("--null-handling")),
  };
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseSamplesFromText = (text: string): Record<string, unknown>[] => {
  const trimmed = text.trim();

  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);

    if (!Array.isArray(parsed)) {
      throw new Error("Expected JSON array");
    }

    return parsed.filter(isObject);
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed);
      return isObject(parsed) ? [parsed] : [];
    } catch (_error) {
      // Fall through to line-based parsing.
    }
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(isObject);
};

export const inferFromSamples = (
  samples: Record<string, unknown>[],
  options: Omit<InferCLIOptions, "inputPath" | "outputPath">
): string => {
  if (options.format === "diff") {
    throw new Error("inferFromSamples does not support diff format");
  }

  const aggregator = createAggregator({
    requiredFieldThreshold: options.requiredFieldThreshold,
    nullHandling: options.nullHandling,
  });

  aggregator.addMany(samples);
  const result = aggregator.finalize();

  if (!result) {
    return options.format === "jsonschema" ? "{}\n" : "R.Record({})\n";
  }

  if (options.format === "runtype") {
    return `${result.code}\n`;
  }

  if (options.format === "jsonschema") {
    return `${JSON.stringify(schemaNodeToJSONSchema(result.schema), null, 2)}\n`;
  }

  return `${schemaNodeToTypeScript(result.schema, {
    requiredFieldThreshold: options.requiredFieldThreshold,
  })}\n`;
};

const isLineDelimitedPath = (inputPath: string) =>
  LINE_DELIMITED_EXTENSIONS.has(path.extname(inputPath).toLowerCase());

export const addSamplesFromFile = async (
  inputPath: string,
  onSample: (sample: Record<string, unknown>) => void
): Promise<number> => {
  let count = 0;

  if (!isLineDelimitedPath(inputPath)) {
    const file = await fsp.readFile(inputPath, "utf8");
    const samples = parseSamplesFromText(file);
    samples.forEach((sample) => {
      onSample(sample);
      count += 1;
    });
    return count;
  }

  const input = fs.createReadStream(inputPath, { encoding: "utf8" });
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  let lineNumber = 0;

  for await (const line of rl) {
    lineNumber += 1;
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(trimmed);
    } catch (_error) {
      throw new Error(
        `Invalid JSON at ${inputPath}:${lineNumber} (expected NDJSON/JSONL line)`
      );
    }

    if (!isObject(parsed)) {
      continue;
    }

    onSample(parsed);
    count += 1;
  }

  return count;
};

export const inferFromFile = async (
  inputPath: string,
  options: Omit<InferCLIOptions, "inputPath" | "outputPath">
): Promise<string> => {
  if (options.format === "diff") {
    throw new Error("inferFromFile does not support diff format");
  }

  const aggregator = createAggregator({
    requiredFieldThreshold: options.requiredFieldThreshold,
    nullHandling: options.nullHandling,
  });

  await addSamplesFromFile(inputPath, (sample) => {
    aggregator.add(sample);
  });

  const result = aggregator.finalize();

  if (!result) {
    return options.format === "jsonschema" ? "{}\n" : "R.Record({})\n";
  }

  if (options.format === "runtype") {
    return `${result.code}\n`;
  }

  if (options.format === "jsonschema") {
    return `${JSON.stringify(schemaNodeToJSONSchema(result.schema), null, 2)}\n`;
  }

  return `${schemaNodeToTypeScript(result.schema, {
    requiredFieldThreshold: options.requiredFieldThreshold,
  })}\n`;
};

export const diffFromFiles = async (
  inputPath: string,
  comparePath: string,
  options: Pick<InferCLIOptions, "requiredFieldThreshold" | "nullHandling">
): Promise<string> => {
  const current = createAggregator({
    requiredFieldThreshold: options.requiredFieldThreshold,
    nullHandling: options.nullHandling,
  });
  await addSamplesFromFile(inputPath, (sample) => current.add(sample));

  const baseline = createAggregator({
    requiredFieldThreshold: options.requiredFieldThreshold,
    nullHandling: options.nullHandling,
  });
  await addSamplesFromFile(comparePath, (sample) => baseline.add(sample));

  const currentResult = current.finalize();
  const baselineResult = baseline.finalize();

  const diff =
    currentResult && baselineResult
      ? diffSchemas(baselineResult.schema, currentResult.schema, {
          requiredFieldThreshold: options.requiredFieldThreshold,
        })
      : [];

  return `${JSON.stringify(diff, null, 2)}\n`;
};

const main = async () => {
  if (process.argv.includes("--help")) {
    process.stdout.write(helpText);
    return;
  }

  const options = parseCLIArgs(process.argv.slice(2));

  if (options.format === "diff") {
    if (!options.comparePath) {
      throw new Error("--compare <path> is required when --format diff");
    }

    const diffOutput = await diffFromFiles(options.inputPath, options.comparePath, {
      requiredFieldThreshold: options.requiredFieldThreshold,
      nullHandling: options.nullHandling,
    });

    if (options.outputPath) {
      await fsp.writeFile(options.outputPath, diffOutput);
      return;
    }

    process.stdout.write(diffOutput);
    return;
  }

  const output = await inferFromFile(options.inputPath, {
    format: options.format,
    requiredFieldThreshold: options.requiredFieldThreshold,
    nullHandling: options.nullHandling,
  });

  if (options.outputPath) {
    await fsp.writeFile(options.outputPath, output);
    return;
  }

  process.stdout.write(output);
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  });
}
