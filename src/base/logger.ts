import winston, { format } from "winston";

type LoggerOptions = {
    level: string;
};

const logger = winston.createLogger();
setupLogger({ level: "debug" });

winston.addColors({
    debug: "gray",
});

function setupLogger(options: LoggerOptions): void {
    logger.configure({
        level: options.level,
        levels: winston.config.npm.levels,
        exitOnError: false,
        format: format.combine(
            format.colorize({ all: true }),
            format.timestamp({ format: 'HH:mm:ss' }),
            format.padLevels(),
            format.printf(info => `${info.timestamp} ${info.level} ${info.message}`),
        ),
        transports: [
            new winston.transports.Console({
                handleExceptions: false,
            }),
        ],
    });
}

export {
    logger,
    setupLogger,
    LoggerOptions,
}
