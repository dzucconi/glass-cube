#!/usr/bin/env node
import fs from "fs/promises";
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

const main = async () => {
  if (process.argv.includes("--help")) {
    process.stdout.write(helpText);
    return;
  }

  const options = parseCLIArgs(process.argv.slice(2));
  const file = await fs.readFile(options.inputPath, "utf8");
  const samples = parseSamplesFromText(file);

  if (options.format === "diff") {
    if (!options.comparePath) {
      throw new Error("--compare <path> is required when --format diff");
    }

    const compareFile = await fs.readFile(options.comparePath, "utf8");
    const compareSamples = parseSamplesFromText(compareFile);

    const current = createAggregator({
      requiredFieldThreshold: options.requiredFieldThreshold,
      nullHandling: options.nullHandling,
    });
    current.addMany(samples);

    const baseline = createAggregator({
      requiredFieldThreshold: options.requiredFieldThreshold,
      nullHandling: options.nullHandling,
    });
    baseline.addMany(compareSamples);

    const currentResult = current.finalize();
    const baselineResult = baseline.finalize();

    const diff =
      currentResult && baselineResult
        ? diffSchemas(baselineResult.schema, currentResult.schema, {
            requiredFieldThreshold: options.requiredFieldThreshold,
          })
        : [];

    const diffOutput = `${JSON.stringify(diff, null, 2)}\n`;

    if (options.outputPath) {
      await fs.writeFile(options.outputPath, diffOutput);
      return;
    }

    process.stdout.write(diffOutput);
    return;
  }

  const output = inferFromSamples(samples, {
    format: options.format,
    requiredFieldThreshold: options.requiredFieldThreshold,
    nullHandling: options.nullHandling,
  });

  if (options.outputPath) {
    await fs.writeFile(options.outputPath, output);
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
