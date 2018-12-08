import { sortBy } from "lodash";
import { Channel, ChannelCategory } from "../../types";

function buildPlaylist(streamsPath: string, channels: Channel[]): string {
    let result = "#EXTM3U\n";
    const sortedChannels = sortChannels(channels);

    for (const c of sortedChannels) {
        result += `#EXTINF:-1,${c.name} (${getCategoryText(c.category)})\n${streamsPath}/${c.id}\n`;
    }

    return result;
}

const categoryTextDict = {
    [ChannelCategory.Movies]: "Фильмы",
    [ChannelCategory.Music]: "Музыка",
    [ChannelCategory.News]: "Новости",
    [ChannelCategory.Sport]: "Спорт",
    [ChannelCategory.Kids]: "Детские",
    [ChannelCategory.Entertaining]: "Развлекательные",
    [ChannelCategory.Educational]: "Познавательные",
    [ChannelCategory.Documentaries]: "Документальные",
    [ChannelCategory.Other]: "Разное",
    [ChannelCategory.Man]: "Мужские",
    [ChannelCategory.Woman]: "Женские",
    [ChannelCategory.Xxx]: "XXX",
    [ChannelCategory.Regional]: "Региональные",
    [ChannelCategory.Religion]: "Религиозные",
};

function getCategoryText(category: ChannelCategory): string {
    return categoryTextDict[category] || categoryTextDict[ChannelCategory.Other];
}

function sortChannels(channels: Channel[]): Channel[] {
    return sortBy(channels, ["category", "name"]);
}

export { buildPlaylist }
