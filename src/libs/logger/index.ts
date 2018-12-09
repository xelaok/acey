import winston, { format } from "winston";

type LoggerOptions = {
    level: string,
}

const logger = winston.createLogger();

function setupLogger(options: LoggerOptions): void {
    logger.configure({
        level: options.level,
        levels: winston.config.npm.levels,
        format: format.combine(
            format.colorize({ all: true }),
            format.timestamp({ format: 'HH:mm:ss' }),
            format.padLevels(),
            format.printf(info => `${info.timestamp} ${info.level} ${info.message}`),
        ),
        transports: [
            new winston.transports.Console(),
        ],
    });
}

export { logger, setupLogger, LoggerOptions }
