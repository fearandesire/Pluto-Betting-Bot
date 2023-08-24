import { MessageEmbed } from 'discord.js'
import {
    embedfooter as defaultFooter,
    helpfooter,
} from '#config'

import { Log } from '#LogColor'
import { fetchChanId } from '#botUtil/fetchChanId'

import { SapDiscClient } from '#main'

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

export async function embedReply(
    interaction,
    embedContent,
    interactionEph,
) {
    const embedColor = embedContent?.color ?? '#e0ff19'
    const embedTitle = embedContent?.title ?? ''
    const embedDescription = embedContent?.description ?? ''
    const embedFields = embedContent?.fields
    const embedFooter =
        embedContent?.footer ?? defaultFooter
    const hasFields = embedFields ?? false
    const confirmFields = !!hasFields
    const target = embedContent?.target || 'reply'
    const isSilent = embedContent?.silent || false
    let followUp = embedContent?.followUp || false
    const editReply = embedContent?.editReply || false
    const thumbnail =
        embedContent?.thumbnail ||
        guildImgURL(interaction?.client)
    let reqChan
    if (
        interaction &&
        interaction?.deferred &&
        interaction?.deferred === true
    ) {
        followUp = true
    }

    // # Embed with no fields response
    if (!confirmFields) {
        const noFieldsEmbed = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            .setThumbnail(thumbnail)
            .setDescription(embedDescription)
        if (target === 'reply' && isSilent === true) {
            if (followUp) {
                return interaction.followUp({
                    embeds: [noFieldsEmbed],
                    ephemeral: true,
                })
            }
            await interaction.reply({
                embeds: [noFieldsEmbed],
                ephemeral: true,
            })
            return
        }
        if (target === 'reply' && isSilent === false) {
            if (editReply) {
                return interaction.editReply({
                    embeds: [noFieldsEmbed],
                })
            }
            if (followUp) {
                return interaction.followUp({
                    embeds: [noFieldsEmbed],
                })
            }
            await interaction.reply({
                embeds: [noFieldsEmbed],
            })
            return
        }
        // # Fields-Embed Destination to a specific channel
        if (target !== 'reply') {
            reqChan = await Promise.resolve(
                fetchChanId(target),
            )
            reqChan.send({ embeds: [noFieldsEmbed] })
            return
        }
    } else {
        return Log.Error(
            `[embedReply.js] Error: Something went wrong with the embedReply function.`,
        )
    }

    // # Embeds with fields response
    if (hasFields !== false) {
        const embedWithFields = new MessageEmbed()
            .setColor(embedColor)
            .setTitle(embedTitle)
            // .setThumbnail(thumbnail)
            .setDescription(embedDescription)
            .addFields(...embedContent.fields)
            .setFooter({ text: embedFooter })
        if (
            (target === 'reply' &&
                interactionEph === true) ||
            (target === 'reply' && isSilent === true)
        ) {
            // # switch .reply to .followUp if the followUp prop is true [deferred replies from slash commands]
            if (followUp === true) {
                return interaction.followUp({
                    embeds: [embedWithFields],
                    ephemeral: true,
                })
            }
            await interaction.reply({
                embeds: [embedWithFields],
                ephemeral: true,
            })
        } else if (target === 'reply' && !interactionEph) {
            await interaction.reply({
                embeds: [embedWithFields],
            })

            // # Non-Field Embed Destination to a specific channel
        } else if (target !== 'reply') {
            if (isSilent === false) {
                reqChan = await fetchChanId(target)
                reqChan.send({ embeds: [embedWithFields] })
            } else if (isSilent) {
                reqChan.send({
                    embeds: [embedWithFields],
                    ephemeral: true,
                })
            }
        }
    }
}

export async function QuickError(
    message,
    text,
    interactionEph,
) {
    const embed = new MessageEmbed()
        .setColor('#ff0000')
        .setTitle(':triangular_flag_on_post: Error')
        .setDescription(text)
        .setFooter({ text: helpfooter })
    if (message?.deferred === true) {
        if (interactionEph === true) {
            await message.followUp({
                embeds: [embed],
                ephemeral: true,
            })
        } else {
            await message.followUp({ embeds: [embed] })
        }
    } else {
        if (interactionEph === true) {
            message.reply({
                embeds: [embed],
                ephemeral: true,
            })
            return
        }
        if (!interactionEph) {
            message.reply({ embeds: [embed] })
            return
        }
        if (interactionEph === true) {
            message.followUp({
                embeds: [embed],
                ephemeral: true,
            })
        } else if (!interactionEph) {
            message.followUp({ embeds: [embed] })
        }
    }
}

export const guildImgURL = (client) => {
    let guild
    if (client) {
        guild = client.guilds.cache.first() // get the first guild in the cache
    }
    if (!client) {
        // Fetch guild info based on server id
        const serverId = process.env.server_ID
        guild = SapDiscClient.guilds.cache.get(serverId)
    }
    if (!guild) {
        return null // no guild found
    }
    const iconURL = guild.iconURL({ dynamic: true }) // get the guild's icon URL
    return iconURL
}
