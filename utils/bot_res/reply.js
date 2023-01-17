/**
 * @module reply
 * @summary Reply to a Discord interaction
 * @description Intended to handle interaction replies by checking if the interaction has been deferred or not.
 *
 * @param {object} interaction - The interaction to reply to
 * @param {object} data - The content and Discord interaction options parameters for the reply.
 *
 * @example {@link data}
 * ```{ content: `Hi there`, ephemeral: true, embeds: [embed], edit: true,}```
 *
 */

export async function reply(interaction, data) {
    const { deferred } = interaction // check if interaction has been deferred
    const edit = data.edit || false // check if this is an editReply
    const { content: replyContent, embed: replyEmbeds } = data
    let embed
    if (replyEmbeds && replyEmbeds.length === 1) {
        embed = replyEmbeds[0]
    }
    if (!deferred && edit) {
        console.error(`
        [reply.js]
        Cannot edit a reply that has not been deferred.
        Sending a reply instead.
        `)
        if (replyEmbeds) {
            await interaction.reply({ content: replyContent, embeds: [embed] })
        } else {
            await interaction.reply({ content: replyContent })
        }
    }
    if (deferred && edit) {
        if (replyEmbeds) {
            await interaction.editReply({
                content: replyContent,
                embeds: [embed],
            })
        } else {
            await interaction.editReply({ content: replyContent })
        }
    }
    if (deferred && !edit) {
        if (replyEmbeds) {
            await interaction.followUp({
                content: replyContent,
                embeds: [embed],
            })
        } else {
            await interaction.followUp({ content: replyContent })
        }
    }
    if (!deferred) {
        if (replyEmbeds) {
            await interaction.reply({
                content: replyContent,
                embeds: [embed],
            })
        }
        if (!embed) {
            await interaction.reply({
                content: replyContent,
            })
        }
    }
}
