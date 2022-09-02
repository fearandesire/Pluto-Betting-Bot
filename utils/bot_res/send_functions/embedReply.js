import { Log } from './consoleLog.js'
import { MessageEmbed } from 'discord.js'
import { embedfooter as defaultFooter } from '../../../lib/PlutoConfig.js'
import { helpfooter } from './../../../lib/PlutoConfig.js'

/**
 * @description {*} This function is used to send an embed to the channel that originated the message.
 * @param {message} message The message object that was sent.
 * @param {embedcontent} embedcontent Object supplied by the caller to be converted into an embed.
 * Example model of `embedcontent` should be something along the lines of:
 *
 * embedcontent = { title: '', description: '', color: '', footer: '', fields: [ { name: '', value: '', inline: '' }, etc. ] }
 * @returns {embed} embedWithFields or noFieldsEmbed - self-descriptive returns.
 */

export function embedReply(message, embedcontent) {
    var embedColor = embedcontent?.color ?? '#e0ff19'
    var embedTitle = embedcontent?.title ?? 'no title'
    var embedDescription = embedcontent?.description ?? 'no description'
    var embedFields = embedcontent?.fields
    var embedFooter = embedcontent?.footer ?? defaultFooter
    var hasFields = embedFields ?? false
    var confirmFields = hasFields ? true : false
    //? if the supplied embed has fields, return embeds with fields
    if (hasFields !== false) {
        const embedWithFields = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .addFields(...embedcontent.fields)
            .setTimestamp()
            .setFooter({ text: embedFooter })
        message.reply({ embeds: [embedWithFields] })
        return
    }
    //? if the supplied embed has no fields, return embed with no fields
    if (confirmFields == false) {
        const noFieldsEmbed = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setTimestamp()
            .setFooter({ text: embedFooter })
        message.reply({ embeds: [noFieldsEmbed] })
        return
    } else {
        return Log.Error(
            `[embedReply.js] Error: Something went wrong with the embedReply function.`,
        )
    }
}

export function QuickError(message, text) {
    const embed = new MessageEmbed()
        .setColor('#ff0000')
        .setTitle('Error')
        .setDescription(text)
        .setTimestamp()
        .setFooter({ text: helpfooter })
    message.reply({ embeds: [embed] })
}
