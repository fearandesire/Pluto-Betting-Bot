import { Log } from './consoleLog.js'
import { MessageEmbed } from 'discord.js'
import { embedfooter as defaultFooter } from '../../../lib/PlutoConfig.js'
import { fetchChanId } from './fetchChanId.js'
import { helpfooter } from './../../../lib/PlutoConfig.js'

/**
 * @description {*} This function is used to send an embed to the channel that originated the message.
 * @param {message} message The message object that was sent.
 * @param {embedContent} embedContent Object supplied by the caller to be converted into an embed.
 * Example model of `embedContent` should be something along the lines of:
 *
 * embedContent = { title: '', description: '', color: '', footer: '', fields: [ { name: '', value: '', inline: '' }, etc. ] }
 * @returns {embed} embedWithFields or noFieldsEmbed - self-descriptive returns.
 */

export async function embedReply(message, embedContent, interactionEph) {
    var embedColor = embedContent?.color ?? '#e0ff19'
    var embedTitle = embedContent?.title ?? ''
    var embedDescription = embedContent?.description ?? ''
    var embedFields = embedContent?.fields
    var embedFooter = embedContent?.footer ?? defaultFooter
    var hasFields = embedFields ?? false
    var confirmFields = hasFields ? true : false
    var target = embedContent?.target || 'reply'
    var isSilent = embedContent?.silent || false
    console.log(`EMBED OBJECT: ===>>`, embedContent)
    var reqChan
    //? if the supplied embed has fields, return embeds with fields
    if (hasFields !== false) {
        const embedWithFields = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .addFields(...embedContent.fields)
            .setTimestamp()
            .setFooter({ text: embedFooter })
        if (
            (target == 'reply' && interactionEph == true) ||
            (target == 'reply' && isSilent === true)
        ) {
            console.log(`SILENT REPLY REQUESTED [FIELDS] [DEBUG]`)
            await message.reply({
                embeds: [embedWithFields],
                ephemeral: true,
            })
            return
        } else if (target == 'reply' && !interactionEph) {
            console.log(`NON SILENT REQUESTED [FIELDS] [DEBUG]`)
            await message.reply({
                embeds: [embedWithFields],
            })
            return

            //# Embed Destination is not a reply, but to a specific channel
        } else if (target !== 'reply') {
            if (isSilent == false || isSilent === false) {
                reqChan = await fetchChanId(target)
                reqChan.send({ embeds: [embedWithFields] })
                return
            } else if (isSilent === true) {
                reqChan.send({ embeds: [embedWithFields], ephemeral: true })
                return
            }
        }
    }
    //& Embed with no fields response
    if (confirmFields == false) {
        const noFieldsEmbed = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setDescription(embedDescription)
            .setTimestamp()
            .setFooter({ text: embedFooter })
        if (target == 'reply' && isSilent === true) {
            console.log(`SILENT REQUESTED [NO-FIELDS] [DEBUG]`)
            await message.reply({ embeds: [noFieldsEmbed], ephemeral: true })
            return
        } else if (target == 'reply' && isSilent === false) {
            console.log(`NON SILENT REQUESTED [NO-FIELDS] [DEBUG]`)
            await message.reply({ embeds: [noFieldsEmbed], ephemeral: true })
            return
        } else if (target !== 'reply') {
            reqChan = await Promise.resolve(fetchChanId(target))
            reqChan.send({ embeds: [noFieldsEmbed] })
            return
        }
    } else {
        return Log.Error(
            `[embedReply.js] Error: Something went wrong with the embedReply function.`,
        )
    }
}

export function QuickError(message, text, interactionEph) {
    const embed = new MessageEmbed()
        .setColor('#ff0000')
        .setTitle('Error')
        .setDescription(text)
        .setTimestamp()
        .setFooter({ text: helpfooter })
    if (interactionEph === true) {
        message.reply({ embeds: [embed], ephemeral: true })
        return
    } else if (!interactionEph) {
        message.reply({ embeds: [embed] })
        return
    }
}
