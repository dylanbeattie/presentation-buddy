type Skipable = { skip?: boolean };

export interface IReadFromAFile {
  path: string;
  qualifiedPath: string
}

export type Command = {
  type: "command";
  command: string;
  args: any[];
  repeat: number;
};

export type Wait = { type: "wait"; delay: number | "manual"; save?: boolean };

export type TypeText = { type: "typeText"; text: string[]; delay?: number };

export type TypeTextFromFile = {
  type: "typeTextFromFile";
  path: string;
  qualifiedPath: string;
  delay?: number;
};

export type TypeChunksFromFile = {
  type: "typeChunksFromFile";
  path: string;
  qualifiedPath: string;
  delay?: number;
  waitInsteadOfTyping: string[];
  waitAfterTyping: string[];
  waitAfterNewLine: boolean | null,
  skipLinesContaining: string[];
};

export type OpenFile = { type: "openFile"; path: string };

export type CreateFile = { type: "createFile"; path: string };

export type GoTo = { type: "goto"; line: number; column: number };

export type Select = { type: "select"; line: number; column: number };

export type Instruction = (
  | Command
  | CreateFile
  | OpenFile
  | TypeText
  | TypeTextFromFile
  | TypeChunksFromFile
  | Wait
) &
  Skipable;

export type InstructionHandler = (instruction: Instruction) => Promise<void>;
