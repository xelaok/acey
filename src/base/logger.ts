import chalk, { Chalk } from "chalk";
import d from "date-fns";
import { splitLines } from "./splitLines";

type Logger = {
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

function createLogger(prefixFormatter?: LogFormatter | string): Logger {
    return {
        error: createLogMethod(
            prefixFormatter,
            "error",
            "E",
            chalk.red,
        ),
        warn: createLogMethod(
            prefixFormatter,
            "warning",
            "W",
            chalk.yellow,
        ),
        info: createLogMethod(
            prefixFormatter,
            "info",
            "I",
            chalk.green,
        ),
        verbose: createLogMethod(
            prefixFormatter,
            "verbose",
            "V",
            chalk.cyan,
        ),
        debug: createLogMethod(
            prefixFormatter,
            "debug",
            "D",
            chalk.gray,
        ),
        silly: createLogMethod(
            prefixFormatter,
            "silly",
            "S",
            chalk.magenta,
        ),
    };
}

function createLogMethod(
    prefix: LogFormatter | string | undefined,
    level: LogLevel,
    levelLabel: string,
    defaultStyle: Chalk,
): LogMethod {
    const prefixValue = prefix instanceof Function
        ? prefix(chalk)
        : prefix;

    const prefixString = prefixValue ? prefixValue + " " : "";

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
            prefixString,
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
                prefixString +
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
