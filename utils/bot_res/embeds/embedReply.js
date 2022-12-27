import { embedfooter as defaultFooter, helpfooter } from '#config'

import { Log } from '#LogColor'
import { MessageEmbed } from 'discord.js'
import { fetchChanId } from '#botUtil/fetchChanId'

/**
 * @module embedReply
 * @description Constructor function for creating & sending embeds
 * @param {message} interaction The message object that was sent.
 * @param {embedContent} embedContent Object supplied to be converted into an embed.
 * Example model of a `embedContent`:
 *
 * ```embedContent = { title: '', description: '', color: '', footer: '', fields: [ { name: '', value: '', inline: '' }, etc. ] }```
 * @returns {embed} embedWithFields or noFieldsEmbed - self-descriptive returns.
 */

export async function embedReply(interaction, embedContent, interactionEph) {
    var embedColor = embedContent?.color ?? '#e0ff19'
    var embedTitle = embedContent?.title ?? ''
    var embedDescription = embedContent?.description ?? ''
    var embedFields = embedContent?.fields
    var embedFooter = embedContent?.footer ?? defaultFooter
    var hasFields = embedFields ?? false
    var confirmFields = hasFields ? true : false
    var target = embedContent?.target || 'reply'
    var isSilent = embedContent?.silent || false
    var followUp = embedContent?.followUp || false
    var thumbnail = embedContent?.thumbnail || process.env.sportLogo
    //debug: console.log(`EMBED OBJECT: ===>>`, embedContent)
    var reqChan
    if (interaction.deferred === true) {
        followUp = true
    }
    //# Embeds with fields response
    if (hasFields !== false) {
        const embedWithFields = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            // .setThumbnail(thumbnail)
            .setDescription(embedDescription)
            .addFields(...embedContent.fields)
            .setFooter({ text: embedFooter })
        if (
            (target == 'reply' && interactionEph == true) ||
            (target == 'reply' && isSilent === true)
        ) {
            //# switch .reply to .followUp if the followUp prop is true [deferred replies from slash commands]
            if (followUp === true) {
                return await interaction.followUp({
                    embeds: [embedWithFields],
                    ephemeral: true,
                })
            } else {
                await interaction.reply({
                    embeds: [embedWithFields],
                    ephemeral: true,
                })
                return
            }
        } else if (target == 'reply' && !interactionEph) {
            await interaction.reply({
                embeds: [embedWithFields],
            })
            return

            //# Non-Field Embed Destination to a specific channel
        } else if (target !== 'reply') {
            if (isSilent == false) {
                reqChan = await fetchChanId(target)
                reqChan.send({ embeds: [embedWithFields] })
                return
            } else if (isSilent == true) {
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
            .setThumbnail(thumbnail)
            .setDescription(embedDescription)
            .setFooter({ text: embedFooter })
        if (target == 'reply' && isSilent === true) {
            if (followUp == true) {
                return await interaction.followUp({
                    embeds: [noFieldsEmbed],
                    ephemeral: true,
                })
            } else {
                await interaction.reply({ embeds: [noFieldsEmbed], ephemeral: true })
                return
            }
        } else if (target == 'reply' && isSilent === false) {
            if (followUp == true) {
                return await interaction.followUp({ embeds: [noFieldsEmbed] })
            } else {
                await interaction.reply({ embeds: [noFieldsEmbed] })
                return
            }
        }
        //# Fields-Embed Destination to a specific channel
        else if (target !== 'reply') {
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

export async function QuickError(message, text, interactionEph) {
    console.log(`Deferred: ${message?.deferred} || Replied: ${message?.replied}`)
    const embed = new MessageEmbed()
        .setColor('#ff0000')
        .setTitle(':triangular_flag_on_post: Error')
        .setDescription(text)
        .setFooter({ text: helpfooter })
    if (message?.deferred === true) {
        if (interactionEph === true) {
            await message.followUp({ embeds: [embed], ephemeral: true })
            return
        } else {
            await message.followUp({ embeds: [embed] })
            return
        }
    } else {
        if (interactionEph === true) {
            message.reply({ embeds: [embed], ephemeral: true })
            return
        } else if (!interactionEph) {
            message.reply({ embeds: [embed] })
            return
        }
        if (interactionEph === true) {
            message.followUp({ embeds: [embed], ephemeral: true })
            return
        } else if (!interactionEph) {
            message.followUp({ embeds: [embed] })
            return
        }
    }
}
