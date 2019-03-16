import chalk, { Chalk } from "chalk";
import d from "date-fns";
import { splitLines } from "./splitLines";

type Logger = {
    prefix: Readonly<string>;
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    verbose: LogMethod;
    debug: LogMethod;
    silly: LogMethod;
};

type LoggerOptions = {
    level: LogLevel;
};

type LogMethod = {
    (message?: LogFormatter | string, details?: ((c: Chalk) => string[]) | string[]): void;
};

type LogFormatter = {
    (c: Chalk): string;
};

type LogLevel = "error" | "warning" | "info" | "verbose" | "debug" | "silly";

const levelPriority: Record<LogLevel, number> = {
    "error": 1,
    "warning": 2,
    "info": 3,
    "verbose": 4,
    "debug": 5,
    "silly": 6,
};

let activeLevel: LogLevel = "debug";

const logger = createLogger();

function setupLogger(options: LoggerOptions): void {
    activeLevel = options.level;
}

function createLogger(prefix?: LogFormatter | string): Logger {
    const prefixValue = prefix instanceof Function
        ? prefix(chalk)
        : prefix;

    const prefixString = prefixValue || "";

    return {
        prefix: prefixString,
        error: createLogMethod(
            prefixString,
            "error",
            "E",
            chalk.red,
        ),
        warn: createLogMethod(
            prefixString,
            "warning",
            "W",
            chalk.yellow,
        ),
        info: createLogMethod(
            prefixString,
            "info",
            "I",
            chalk.green,
        ),
        verbose: createLogMethod(
            prefixString,
            "verbose",
            "V",
            chalk.cyan,
        ),
        debug: createLogMethod(
            prefixString,
            "debug",
            "D",
            chalk.gray,
        ),
        silly: createLogMethod(
            prefixString,
            "silly",
            "S",
            chalk.magenta,
        ),
    };
}

function createLogMethod(
    prefix: string,
    level: LogLevel,
    levelLabel: string,
    defaultStyle: Chalk,
): LogMethod {
    return (
        message: LogFormatter | string | undefined,
        detailMessages?: ((c: Chalk) => string[]) | string[],
    ) => {
        if (levelPriority[level] > levelPriority[activeLevel]) {
            return nullLoggerMethod;
        }

        const dateString = chalk.gray(d.format(Date.now(), "HH:mm:ss.SSS"));

        logLine(
            dateString,
            prefix,
            levelLabel,
            defaultStyle,
            message,
            "",
        );

        if (!detailMessages) {
            return;
        }

        let detailMessagesResult = detailMessages instanceof Array
            ? detailMessages
            : detailMessages(chalk);

        for (const message of detailMessagesResult) {
            if (!message) {
                continue;
            }

            logLine(
                dateString,
                "",
                levelLabel,
                defaultStyle,
                message,
                " ",
            );
        }
    };
}

function logLine(
    dateString: string,
    prefixString: string,
    levelLabel: string,
    defaultStyle: Chalk,
    message: LogFormatter | string | undefined,
    messagePrefix: string,
): void {
    const messageValue = message instanceof Function
        ? message(chalk)
        : message
    ;

    const messageLines = messageValue
        ? splitLines(messageValue.toString(), false, false)
        : [""]
    ;

    for (const line of messageLines) {
        console.log(
            dateString + " " +
            defaultStyle(
                chalk.bold(levelLabel) + " " +
                (prefixString ? prefixString + " " : "") +
                (messagePrefix ? messagePrefix + " " : "") +
                line
            ));
    }
}

function nullLoggerMethod() {}

export {
    logger,
    setupLogger,
    createLogger,
    Logger,
    LoggerOptions,
    LogMethod,
    LogLevel,
    LogFormatter,
}
