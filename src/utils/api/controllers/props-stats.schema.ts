import { z } from "zod";

const h2HPercentagesSchema = z.object({
    home: z.number(),
    away: z.number()
}).describe("The goal of the compilation of methods in this class is to achieve an object of formatted embeds data that are ready to send to the guilds.\nThe formatted embeds should follow something along the lines of:\nTitle: 'Accuracy Challenge Stats'\nDescription: '## away team vs. home team'\nFields:\n- Over: percentages.over\n- Under: percentages.under\n\nIf the market key is 'h2h', then the fields in 'percentages' will be the home and away team.\nSo we will anonymously handle it, regardless of what the field name is");

const overUnderPercentagesSchema = z.object({
    over: z.number(),
    under: z.number()
});