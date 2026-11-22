import chalk from "chalk";
import { inspect } from "util";

export class logger {
  public static build(args: unknown[]): string[] {
    const argrray = args.map((arg) => {
      if (typeof arg === "object") {
        return inspect(arg, { depth: null, colors: true });
      }
      if (typeof arg === "string") {
        return arg;
      }
      throw new Error("Arguments must be an array of strings or objects");
    });

    if (argrray.length === 0) {
      return ["No arguments provided"];
    }
    return argrray;
  }
  public static log(...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const final = logger.build(args);
    console.log(chalk.gray(`[${timestamp}]`), ...final);
  }
  public static error(...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const final = logger.build(args);
    console.error(chalk.red(`[${timestamp}]`), ...final);
  }
  public static warn(...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const final = logger.build(args);
    console.error(chalk.yellow(`[${timestamp}]`), ...final);
  }
  public static info(...args: unknown[]): void {
    const timestamp = new Date().toISOString();
    const final = logger.build(args);
    console.info(chalk.blue(`[${timestamp}]`), ...final);
  }
}
