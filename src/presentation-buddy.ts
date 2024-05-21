import { window, workspace } from 'vscode';
import { join, dirname, sep as pathSeparator } from 'path';
import { jsonc } from 'jsonc';

import { Instruction, InstructionHandler, IReadFromAFile } from './instructions';
import * as instructionHandlers from './instruction-handlers';
import { existsAsync, mkdirIfNotExists } from './utils';

export const init = async () => {
  if (!workspace.workspaceFolders) {
    return;
  }
  const workspaceFolder = workspace.workspaceFolders[0].uri.fsPath;

  const json = await jsonc.read(
    join(__dirname, '..', 'examples', 'init', 'instructions.json')
  );

  const dir = join(workspaceFolder, '.presentation-buddy');
  const fileName = join(dir, 'instructions.json');
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

function getPossibleInstructionPaths(workspaceFolder: string) {
  var segments = workspaceFolder.split(pathSeparator);
  const possibleInstructionFilePaths = new Array();
  for (var i = segments.length; i > 0; i--) {
    const pathBits = segments.slice(0, i).concat(['.presentation-buddy', ...segments.slice(i), 'instructions.json']);
    possibleInstructionFilePaths.push(join(...pathBits));
  }
  return possibleInstructionFilePaths;
}

const fileReaderInstructionTypes = ["typeTextFromFile", "typeChunksFromFile"];
function readsFromFile(inst: Instruction) : inst is Instruction & IReadFromAFile {
  return fileReaderInstructionTypes.includes(inst.type);
}

async function loadInstructions(workspaceFolder: string): Promise<Instruction[]> {
  const filePaths = getPossibleInstructionPaths(workspaceFolder);
  for (var filePath of filePaths) {
    if (await existsAsync(filePath)) {
      let dir = dirname(filePath);
      let instructions: Instruction[] = await jsonc.read(filePath);
      instructions = instructions.filter((instruction) => !instruction.skip);
      for (var instruction of instructions.filter(readsFromFile)) {
        instruction.qualifiedPath = join(dir, instruction.path);
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
