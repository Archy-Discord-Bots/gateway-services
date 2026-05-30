import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import { loadGuildConfig, setGuildConfig } from '../storage/cache.js'
import { uploadBinary } from '../storage/hfClient.js'

export const data = new SlashCommandBuilder()
  .setName('welcome-background')
  .setDescription('Set the background image for the welcome card')
  .addSubcommand((sub) =>
    sub
      .setName('default')
      .setDescription('Choose one of the built-in background styles')
      .addStringOption((opt) =>
        opt
          .setName('style')
          .setDescription('The background style to use')
          .setRequired(true)
          .addChoices(
            { name: 'Style 1', value: 'default1' },
            { name: 'Style 2', value: 'default2' },
            { name: 'Style 3', value: 'default3' }
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('upload')
      .setDescription('Upload a custom background image (PNG or JPG, 800x200)')
      .addAttachmentOption((opt) =>
        opt
          .setName('image')
          .setDescription('Upload a custom background image (PNG or JPG, 800x200)')
          .setRequired(true)
      )
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

  if (sub === 'default') {
    const style = getOpt('style')
    const styleNames = { default1: 'Style 1', default2: 'Style 2', default3: 'Style 3' }

    const config = await loadGuildConfig(guildId)
    config.welcomeBackground = style
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Welcome Background Updated')
      .setDescription('Background set to ' + styleNames[style])

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'upload') {
    // Defer with a loading response first
    res.json({ type: 5, data: { flags: 64 } })

    const resolved = interaction.data.resolved ?? {}
    const attachments = resolved.attachments ?? {}
    const attachmentId = (interaction.data.options[0].options ?? []).find(
      (o) => o.name === 'image'
    )?.value
    const attachment = attachments[attachmentId]

    if (!attachment?.content_type?.startsWith('image/')) {
      await fetch(
        'https://discord.com/api/v10/webhooks/' +
          process.env.DISCORD_CLIENT_ID +
          '/' +
          interaction.token +
          '/messages/@original',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'Invalid file type. Please upload a PNG or JPG image.' }),
        }
      )
      return
    }

    if (attachment.size > 2097152) {
      await fetch(
        'https://discord.com/api/v10/webhooks/' +
          process.env.DISCORD_CLIENT_ID +
          '/' +
          interaction.token +
          '/messages/@original',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: 'File is too large. Maximum allowed size is 2MB.' }),
        }
      )
      return
    }

    const response = await fetch(attachment.url)
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    await uploadBinary('guilds/' + guildId + '/assets/welcome_bg.png', buffer, 'image/png')

    const config = await loadGuildConfig(guildId)
    config.welcomeBackground = 'custom'
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Welcome Background Uploaded')
      .setDescription('Your custom welcome background is now active.')

    await fetch(
      'https://discord.com/api/v10/webhooks/' +
        process.env.DISCORD_CLIENT_ID +
        '/' +
        interaction.token +
        '/messages/@original',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed.toJSON()] }),
      }
    )
  }
}
