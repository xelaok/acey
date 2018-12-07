import { Channel, ChannelCategory } from "../types";

function buildPlaylist(streamsPath: string, channels: Channel[]): string {
    let result = "#EXTM3U\n";

    for (const c of channels) {
        result += `#EXTINF:-1,${c.name} (${getCategoryText(c.category)})\n${streamsPath}/${formatUrl(c.name)}\n`;
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

function formatUrl(name: string): string {
    return Buffer.from(name).toString("hex");
}

export { buildPlaylist }
