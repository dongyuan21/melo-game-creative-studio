import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createDefaultGameRegistry } from '../../bootstrap/headlessBootstrap.js';
import { validateStudioProjectDocumentV2 } from '../../game-runtime/projectDocument.js';
import { MeloHeadlessError } from '../../headless/errors.js';
import { migrateUnknownProjectToV2 } from '../../games/block-placement/migrations/blockPlacementV1';

export async function commandProjectMigrate(inputPath: string, outputPath?: string): Promise<unknown> {
  let source: unknown;
  try {
    source = JSON.parse(await readFile(inputPath, 'utf8'));
  } catch (error) {
    throw new MeloHeadlessError('JSON_READ_FAILED', `Unable to read JSON file ${inputPath}.`, {
      path: inputPath,
      details: error instanceof Error ? error.message : error,
    });
  }
  try {
    const { document, report } = migrateUnknownProjectToV2(source);
    validateStudioProjectDocumentV2(document, createDefaultGameRegistry());
    if (outputPath) {
      await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    }
    return {
      ok: true,
      rendered: false,
      file: resolve(inputPath),
      out: outputPath ? resolve(outputPath) : null,
      report,
    };
  } catch (error) {
    throw new MeloHeadlessError(
      'PROJECT_MIGRATE_FAILED',
      error instanceof Error ? error.message : String(error),
      {
        path: inputPath,
        details: error instanceof Error && 'code' in error ? (error as { code: unknown }).code : error,
      },
    );
  }
}
