import { generateAnsiCArtifacts } from "@/src/codegen/cCodegen";
import { SimulationGraph } from "@/src/simulation/types";

export interface CodegenArtifactFile {
  path: string;
  content: string;
}

export interface CodegenArtifactManifestEntry {
  path: string;
  checksum: string;
  bytes: number;
}

export interface CodegenArtifactManifest {
  algorithm: "fnv1a32";
  entries: CodegenArtifactManifestEntry[];
  packageChecksum: string;
}

export interface CodegenArtifactMetadata {
  schemaVersion: 1;
  modelName: string;
  nodeCount: number;
  edgeCount: number;
  unsupportedBlockTypes: string[];
  generatedAt: "deterministic";
}

export interface CodegenArtifactPackage {
  modelName: string;
  files: CodegenArtifactFile[];
  manifest: CodegenArtifactManifest;
  metadata: CodegenArtifactMetadata;
}

function toUtf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
    hash >>>= 0;
  }

  return hash.toString(16).padStart(8, "0");
}

function computeManifest(files: CodegenArtifactFile[]): CodegenArtifactManifest {
  const entries = files
    .slice()
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => ({
      path: file.path,
      checksum: fnv1a32(file.content),
      bytes: toUtf8ByteLength(file.content),
    }));

  const packageSignature = entries
    .map((entry) => `${entry.path}:${entry.checksum}:${entry.bytes}`)
    .join("\n");

  return {
    algorithm: "fnv1a32",
    entries,
    packageChecksum: fnv1a32(packageSignature),
  };
}

export function buildCodegenArtifactPackage(params: {
  modelName: string;
  graph: SimulationGraph;
}): CodegenArtifactPackage {
  const artifacts = generateAnsiCArtifacts(params);

  const files: CodegenArtifactFile[] = [
    {
      path: `${artifacts.ir.modelName}.h`,
      content: artifacts.headerSource,
    },
    {
      path: `${artifacts.ir.modelName}.c`,
      content: artifacts.sourceSource,
    },
    {
      path: `${artifacts.ir.modelName}.ir.json`,
      content: JSON.stringify(artifacts.ir, null, 2),
    },
  ];

  const manifest = computeManifest(files);
  const metadata: CodegenArtifactMetadata = {
    schemaVersion: 1,
    modelName: artifacts.ir.modelName,
    nodeCount: artifacts.ir.nodes.length,
    edgeCount: artifacts.ir.edges.length,
    unsupportedBlockTypes: artifacts.ir.unsupportedBlockTypes,
    generatedAt: "deterministic",
  };

  return {
    modelName: artifacts.ir.modelName,
    files,
    manifest,
    metadata,
  };
}

export function serializeCodegenArtifactPackage(pkg: CodegenArtifactPackage): string {
  return JSON.stringify(pkg, null, 2);
}
