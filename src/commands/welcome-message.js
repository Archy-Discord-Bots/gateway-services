import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { loadGuildConfig, setGuildConfig } from '../storage/cache.js'
import { parseTemplate } from '../utils/templateParser.js'

export const data = new SlashCommandBuilder()
  .setName('welcome-message')
  .setDescription('Customize the welcome message sent in the welcome channel')
  .addSubcommand((sub) =>
    sub
      .setName('set')
      .setDescription('Set the welcome message template')
      .addStringOption((opt) =>
        opt
          .setName('message')
          .setDescription('The welcome message template')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(500)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('set-dm')
      .setDescription('Set the private DM sent to new members')
      .addStringOption((opt) =>
        opt
          .setName('message')
          .setDescription('The DM message template')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(1000)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('preview')
      .setDescription('Preview the current welcome message template')
  )

export async function execute(interaction, res) {
  const perms = BigInt(interaction.member.permissions)
  const MANAGE_GUILD = 32n
  if (!(perms & MANAGE_GUILD)) {
    return res.json({
      type: 4,
      data: { content: 'You need Manage Server permission to use this command.', flags: 64 },
    })
  }

  const sub = interaction.data.options[0].name
  const guildId = interaction.guild_id

  const getOpt = (name) => {
    const opts = interaction.data.options[0].options ?? []
    return opts.find((o) => o.name === name)?.value ?? null
  }

  if (sub === 'set') {
    const message = getOpt('message')
    const config = await loadGuildConfig(guildId)
    config.welcomeMessage = message
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Welcome Message Updated')
      .setDescription(`\`\`\`\n${message}\n\`\`\``)
      .setFooter({ text: 'Variables: {user} {username} {server} {count}' })

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'set-dm') {
    const message = getOpt('message')
    const config = await loadGuildConfig(guildId)
    config.dmMessage = message
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('DM Message Updated')
      .setDescription(`\`\`\`\n${message}\n\`\`\``)
      .setFooter({ text: 'Variables: {username} {server}' })

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'preview') {
    const config = await loadGuildConfig(guildId)
    const guildName = interaction.guild?.name ?? 'Your Server'
    const preview = parseTemplate(config.welcomeMessage, {
      user: `<@${interaction.member.user.id}>`,
      username: interaction.member.user.username,
      server: guildName,
      count: String(interaction.guild?.member_count ?? 0),
    })

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Welcome Message Preview')
      .setDescription(preview)

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }
}
