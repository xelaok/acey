import { ChannelCategory } from "../types";

const map: { [key: string]: ChannelCategory } = {
    "informational": ChannelCategory.Other,
    "none": ChannelCategory.Other,
    "entertaining": ChannelCategory.Entertaining,
    "movies": ChannelCategory.Movies,
    "educational": ChannelCategory.Educational,
    "kids": ChannelCategory.Kids,
    "Movies": ChannelCategory.Movies,
    "regional": ChannelCategory.Regional,
    "Кино": ChannelCategory.Movies,
    "познавательные": ChannelCategory.Educational,
    "music": ChannelCategory.Music,
    "documentaries": ChannelCategory.Documentaries,
    "sport": ChannelCategory.Sport,
    "tv": ChannelCategory.Other,
    "MÚSICA - MUSIC": ChannelCategory.Music,
    "MUSIC TV": ChannelCategory.Music,
    "religion": ChannelCategory.Religion,
    "erotic_18_plus": ChannelCategory.Xxx,
    "other_18_plus": ChannelCategory.Xxx,
    "amateur": ChannelCategory.Other,
    "webcam": ChannelCategory.Other,
    "series": ChannelCategory.Other,
    "other": ChannelCategory.Other,
    "TV": ChannelCategory.Other,
    "Музыкальные": ChannelCategory.Music,
    "Развлекательные": ChannelCategory.Entertaining,
    "Музыка": ChannelCategory.Music,
    "Общие": ChannelCategory.Other,
    "Познавательные": ChannelCategory.Educational,
    "Мужские": ChannelCategory.Man,
    "Региональные": ChannelCategory.Regional,
    "Новостные": ChannelCategory.News,
    "Фильмы": ChannelCategory.Movies,
    "Спорт": ChannelCategory.Sport,
    "Эротика": ChannelCategory.Xxx,
    "Религиозные": ChannelCategory.Religion,
};

function parseChannelCategory(s: string): ChannelCategory {
    let result = map[s];

    if (result === undefined) {
        result = ChannelCategory.Other;
    }

    return result;
}

export { parseChannelCategory }
