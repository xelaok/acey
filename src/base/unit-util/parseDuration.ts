import { DAY, HOUR, MILLISECOND, MINUTE, SECOND, WEEK } from "./consts";
import { DurationUnit } from "./DurationUnit";

function parseDuration(
    s: string,
    defaultUnit: DurationUnit = DurationUnit.Second,
): number {
    const match = /(\d+)(\w*)/.exec(s);
    const value = match ? Number.parseInt(match[1], 10) : 0;
    const unit = parseUnit(match ? match[2] : "", defaultUnit);

    return getValue(value, unit);
}

function parseUnit(s: string, defaultUnit: DurationUnit): DurationUnit {
    switch (s) {
        case "s":
            return DurationUnit.Second;
        case "ms":
            return DurationUnit.Millisecond;
        case "m":
            return DurationUnit.Minute;
        case "h":
            return DurationUnit.Hour;
        case "d":
            return DurationUnit.Day;
        case "w":
            return DurationUnit.Week;
        default:
            return defaultUnit;
    }
}

function getValue(value: number, unit: DurationUnit): number {
    switch (unit) {
        case DurationUnit.Second:
            return value * SECOND;
        case DurationUnit.Millisecond:
            return value * MILLISECOND;
        case DurationUnit.Minute:
            return value * MINUTE;
        case DurationUnit.Hour:
            return value * HOUR;
        case DurationUnit.Day:
            return value * DAY;
        case DurationUnit.Week:
            return value * WEEK;
        default:
            throw new Error(`Unknown unit: "${unit}"`);
    }
}

export { parseDuration }
