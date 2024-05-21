import { window, workspace } from 'vscode';
import * as path from 'path';
import { jsonc } from 'jsonc';

import { Instruction, InstructionHandler, IReadFromAFile, TypeTextFromFile, TypeChunksFromFile } from './instructions';
import * as instructionHandlers from './instruction-handlers';
import { existsAsync, mkdirIfNotExists } from './utils';

const PB_PATH = '.presentation-buddy';
const PB_FILE = 'instructions.json';
export const init = async () => {
  if (!workspace.workspaceFolders) {
    return;
  }
  const workspaceFolder = workspace.workspaceFolders[0].uri.fsPath;

  const json = await jsonc.read(
    path.join(__dirname, '..', 'examples', 'init', PB_FILE)
  );

  const dir = path.join(workspaceFolder, PB_PATH);
  const fileName = path.join(dir, PB_FILE);
  if (await existsAsync(fileName)) {
    window.showWarningMessage(
      `File ${fileName} exists: overwrite it?`, "Yes", "No"
    ).then(async answer => {
      if (answer === "Yes") {
        await jsonc.write(fileName, json, { space: 2 });
      };
    });
  } else {
    await mkdirIfNotExists(dir);
    await jsonc.write(fileName, json, { space: 2 });
  }
};

export const start = async () => {
  if (!workspace.workspaceFolders) {
    return;
  }
  const workspaceFolder = workspace.workspaceFolders[0].uri.fsPath;

  const instructions = await loadInstructions(workspaceFolder);
  let instruction = instructions.shift();

  while (instruction) {
    const handler = instructionHandlers[instruction.type] as InstructionHandler;

    if (handler) {
      await handler(instruction);
    } else {
      window.showErrorMessage(`Unkown instruction type '${instruction.type}'`);
    }

    instruction = instructions.shift();
  }

  console.log(instructions);
};

function readsFromFilePath(instruction: Instruction)
  : instruction is TypeTextFromFile | TypeChunksFromFile {
  return true;
}

function getPossibleInstructionPaths(workspaceFolder: string) {
  var segments = workspaceFolder.split(path.sep);
  const possibleInstructionFilePaths = new Array();
  for (var i = segments.length; i > 0; i--) {
    const pathBits = segments.slice(0, i).concat([PB_PATH, ...segments.slice(i), PB_FILE]);
    possibleInstructionFilePaths.push(path.join(...pathBits));
  }
  return possibleInstructionFilePaths;
}

async function loadInstructions(workspaceFolder: string): Promise<Instruction[]> {
  const filePaths = getPossibleInstructionPaths(workspaceFolder);
  for (var filePath of filePaths) {
    if (await existsAsync(filePath)) {
      let dir = path.dirname(filePath);
      let instructions: Instruction[] = await jsonc.read(filePath);
      instructions = instructions.filter((instruction) => !instruction.skip);
      for (var instruction of instructions.filter(readsFromFilePath)) {
        instruction.qualifiedPath = path.join(dir, instruction.path);
      }
      return instructions;
    }
  }
  window.showErrorMessage(`Couldn't start Presentation Buddy - no instructions.json found.

Searched:

• ${filePaths.join('\n• ')}
`, { modal: true });
  return [];
}
