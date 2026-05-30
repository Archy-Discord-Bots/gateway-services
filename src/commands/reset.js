import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { initGuildConfig } from '../storage/cache.js'

export const data = new SlashCommandBuilder()
  .setName('reset')
  .setDescription('Reset all bot settings for this server to defaults')
  .addSubcommand((sub) =>
    sub
      .setName('confirm')
      .setDescription('Confirm the reset — this cannot be undone')
      .addStringOption((opt) =>
        opt
          .setName('confirmation')
          .setDescription('Type RESET to confirm')
          .setRequired(true)
      )
  )

export async function execute(interaction, res) {
  const perms = BigInt(interaction.member.permissions)
  const MANAGE_GUILD = 32n
  const ADMINISTRATOR = 8n
  if (!(perms & MANAGE_GUILD) || !(perms & ADMINISTRATOR)) {
    return res.json({
      type: 4,
      data: {
        content: 'You need both Manage Server and Administrator permissions to use this command.',
        flags: 64,
      },
    })
  }

  const sub = interaction.data.options[0].name

  if (sub === 'confirm') {
    const confirmation = (interaction.data.options[0].options ?? []).find(
      (o) => o.name === 'confirmation'
    )?.value

    if (confirmation !== 'RESET') {
      return res.json({
        type: 4,
        data: { content: 'You must type RESET exactly to confirm.', flags: 64 },
      })
    }

    await initGuildConfig(interaction.guild_id)

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Server Config Reset')
      .setDescription(
        'All settings have been reset to defaults.\nYou will need to run /setup channels again.'
      )

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }
}
