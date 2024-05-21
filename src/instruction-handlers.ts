import {
  commands,
  Position,
  Selection,
  TextEditorRevealType,
  Uri,
  window,
  workspace,
} from 'vscode';
import { join, dirname } from 'path';

import {
  Command,
  TypeText,
  OpenFile,
  GoTo,
  Select,
  CreateFile,
  Wait,
  TypeTextFromFile,
  TypeChunksFromFile,
  IReadFromAFile
} from './instructions';
import {
  mkdirIfNotExists,
  writeFileAsync,
  timeout,
  getDelay,
  readFileAsync,
  getRandomness,
  splitTextIntoChunks,
  getWaitAfterTyping,
  getWaitInsteadOfTyping,
  getSkipLinesContaining,
  getWaitAfterNewLine
} from './utils';
import { setAwaiter } from './wait-for-input';

const readFileContents = async (
  instruction: IReadFromAFile
) : Promise<string> => {
  if (!workspace.workspaceFolders) {
    return "";
  }
  return await readFileAsync(instruction.qualifiedPath);
};

export const typeTextFromFile = async (
  instruction: TypeTextFromFile
): Promise<void> => {

  const text = await readFileContents(instruction);
  if (text === '') { return; }
  const data = Array.from(text.split('\r\n').join('\n'));

  await typeTextIntoActiveTextEditor(data, instruction.delay);
};

export const typeChunksFromFile = async (
  instruction: TypeChunksFromFile
): Promise<void> => {

  const text = await readFileContents(instruction);
  if (text === '') { return; }

  const waitInsteadOf = instruction.waitInsteadOfTyping || getWaitInsteadOfTyping();
  const waitAfter = instruction.waitAfterTyping ||  getWaitAfterTyping();
  const skipLinesContaining = instruction.skipLinesContaining ||  getSkipLinesContaining();
  const waitAfterNewLine = instruction.waitAfterNewLine ?? getWaitAfterNewLine() ?? true;

  if (waitAfterNewLine) { waitAfter.push('\n'); }

  var chunks = splitTextIntoChunks(text, waitInsteadOf, waitAfter, skipLinesContaining);
  for (const chunk of chunks) {
    await typeTextIntoActiveTextEditor(Array.from(chunk), instruction.delay);
    if (chunk.endsWith('\n')) {
      await command({ type: "command", command: "cursorHome", args: [], repeat: 1 });
    }
    await wait({ delay: "manual", type: 'wait' });
  }
};

export const typeText = async (instruction: TypeText): Promise<void> => {
  const data = Array.from(instruction.text.join('\n'));

  await typeTextIntoActiveTextEditor(data, instruction.delay);
};

const typeTextIntoActiveTextEditor = async (
  data: string[],
  delay?: number
): Promise<void> => {
  const delayBetweenChars = delay || getDelay();
  const randomness = Math.min(delayBetweenChars, getRandomness());
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  if (!editor.selection.isEmpty) {
    await editor.edit((editorBuilder) =>
      editorBuilder.delete(editor.selection)
    );
  }

  let char = data.shift();
  let pos = editor.selection.start;

  while (char) {
    await editor.edit((editBuilder) => {
      editor.selection = new Selection(pos, pos);

      editBuilder.insert(editor.selection.active, char!);
      if (char === '\n') {
        pos = new Position(pos.line + 1, pos.character);
        // scroll to current line if needed
        editor.revealRange(editor.selection, TextEditorRevealType.Default);
      } else {
        pos = new Position(pos.line, pos.character + 1);
      }
    });

    char = data.shift();

    // give me a random number between -randomness and +randomness
    const randomDelay =
      delayBetweenChars +
      (Math.floor(Math.random() * randomness * 2) - randomness);

    delay === 0 ? void 0 : await timeout(randomDelay);
  }
};

export const command = async (instruction: Command): Promise<void> => {
  const { args = [], repeat = 1 } = instruction;

  for (let index = 0; index < repeat; index++) {
    await commands.executeCommand(instruction.command, ...args);
    await timeout(getDelay());
  }
};

export const openFile = async (instruction: OpenFile): Promise<void> => {
  if (!workspace.workspaceFolders) {
    return;
  }

  const workspaceFolder = workspace.workspaceFolders[0].uri.fsPath;
  const uri = Uri.file(join(workspaceFolder, instruction.path));
  await commands.executeCommand('vscode.open', uri);
  await timeout(getDelay());
};

export const createFile = async (instruction: CreateFile): Promise<void> => {
  if (!workspace.workspaceFolders) {
    return;
  }

  const workspaceFolder = workspace.workspaceFolders[0].uri.fsPath;
  const path = join(workspaceFolder, instruction.path);

  await mkdirIfNotExists(dirname(path));
  await writeFileAsync(path);
  const uri = Uri.file(path);
  await commands.executeCommand('vscode.open', uri);
  await timeout(getDelay());
};

export const goto = async (instruction: GoTo): Promise<void> => {
  const { line = 1, column = 1 } = instruction;
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  const position = new Position(line - 1, column - 1);
  editor.selection = new Selection(position, position);
  editor.revealRange(
    editor.selection,
    TextEditorRevealType.InCenterIfOutsideViewport
  );

  await timeout(getDelay());
};

export const select = async (instruction: Select): Promise<void> => {
  const { line = 1, column = 1 } = instruction;
  const editor = window.activeTextEditor;
  if (!editor) {
    return;
  }

  const end = new Position(line - 1, column - 1);
  editor.selection = new Selection(editor.selection.start, end);
  editor.revealRange(
    editor.selection,
    TextEditorRevealType.InCenterIfOutsideViewport
  );

  await timeout(getDelay());
};

export const wait = (instruction: Wait): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    if (instruction.save) {
      await command({
        type: 'command',
        command: 'workbench.action.files.saveAll',
        args: [],
        repeat: 1,
      });
    }

    if (typeof instruction.delay === 'number') {
      await timeout(instruction.delay);
      resolve();
    } else if (instruction.delay === 'manual') {
      setAwaiter(() => {
        resolve();
      });
    } else {
      reject();
    }
  });
};
