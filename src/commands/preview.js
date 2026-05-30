import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { loadGuildConfig } from '../storage/cache.js'
import { generateWelcomeCard } from '../canvas/welcomeCard.js'
import { generateLeaveCard } from '../canvas/leaveCard.js'

export const data = new SlashCommandBuilder()
  .setName('preview')
  .setDescription('Preview the welcome or leave card for this server')
  .addSubcommand((sub) =>
    sub
      .setName('welcome')
      .setDescription('Preview the welcome card')
  )
  .addSubcommand((sub) =>
    sub
      .setName('leave')
      .setDescription('Preview the leave card')
  )

export async function execute(interaction, res) {
  const sub = interaction.data.options[0].name
  const guildId = interaction.guild_id

  // Defer with ephemeral loading state
  res.json({ type: 5, data: { flags: 64 } })

  const config = await loadGuildConfig(guildId)

  const user = interaction.member.user
  const guildName = interaction.guild?.name ?? 'Your Server'
  const memberCount = interaction.guild?.member_count ?? 0

  const cardData = {
    userId: user.id,
    username: user.username,
    avatarURL: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`,
    guildName,
    memberCount,
    guildId,
    cardTextColor: config.cardTextColor,
    cardAccentColor: config.cardAccentColor,
    background: sub === 'welcome' ? config.welcomeBackground : config.leaveBackground,
    isCustom: (sub === 'welcome' ? config.welcomeBackground : config.leaveBackground) === 'custom',
  }

  if (sub === 'welcome') {
    const buffer = await generateWelcomeCard(cardData)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Welcome Card Preview')
      .setDescription('This is how your welcome card will look.')
      .setImage('attachment://preview-welcome.png')

    const formData = new FormData()
    formData.append(
      'payload_json',
      JSON.stringify({ embeds: [embed.toJSON()] })
    )
    formData.append(
      'files[0]',
      new Blob([buffer], { type: 'image/png' }),
      'preview-welcome.png'
    )

    await fetch(
      'https://discord.com/api/v10/webhooks/' +
        process.env.DISCORD_CLIENT_ID +
        '/' +
        interaction.token +
        '/messages/@original',
      { method: 'PATCH', body: formData }
    )
    return
  }

  if (sub === 'leave') {
    const buffer = await generateLeaveCard(cardData)

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Leave Card Preview')
      .setDescription('This is how your leave card will look.')
      .setImage('attachment://preview-leave.png')

    const formData = new FormData()
    formData.append(
      'payload_json',
      JSON.stringify({ embeds: [embed.toJSON()] })
    )
    formData.append(
      'files[0]',
      new Blob([buffer], { type: 'image/png' }),
      'preview-leave.png'
    )

    await fetch(
      'https://discord.com/api/v10/webhooks/' +
        process.env.DISCORD_CLIENT_ID +
        '/' +
        interaction.token +
        '/messages/@original',
      { method: 'PATCH', body: formData }
    )
    return
  }
}
