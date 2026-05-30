import { SlashCommandBuilder, ChannelType, EmbedBuilder } from 'discord.js'
import { loadGuildConfig, setGuildConfig } from '../storage/cache.js'

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure the bot for this server')
  .addSubcommand((sub) =>
    sub
      .setName('channels')
      .setDescription('Set the welcome and leave channels')
      .addChannelOption((opt) =>
        opt
          .setName('welcome')
          .setDescription('Channel to post welcome messages in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
      .addChannelOption((opt) =>
        opt
          .setName('leave')
          .setDescription('Channel to post leave messages in')
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('autorole-add')
      .setDescription('Add a role to be assigned when a member joins')
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('Role to auto-assign')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('autorole-remove')
      .setDescription('Remove a role from auto-assign list')
      .addRoleOption((opt) =>
        opt
          .setName('role')
          .setDescription('Role to remove')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('autorole-list')
      .setDescription('Show all currently configured auto-assign roles')
  )
  .addSubcommand((sub) =>
    sub
      .setName('dm')
      .setDescription('Toggle welcome DM on or off')
      .addBooleanOption((opt) =>
        opt
          .setName('enabled')
          .setDescription('Send a DM to new members when they join')
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

  if (sub === 'channels') {
    const welcomeId = getOpt('welcome')
    const leaveId = getOpt('leave')

    const config = await loadGuildConfig(guildId)
    config.welcomeChannelId = welcomeId
    config.leaveChannelId = leaveId
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Channels Updated')
      .setDescription(
        `✅ Welcome channel set to <#${welcomeId}>\n✅ Leave channel set to <#${leaveId}>`
      )

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'autorole-add') {
    const roleId = getOpt('role')
    const config = await loadGuildConfig(guildId)

    if (config.autoRoles.includes(roleId)) {
      return res.json({
        type: 4,
        data: { content: 'That role is already in the auto-assign list.', flags: 64 },
      })
    }

    config.autoRoles.push(roleId)
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('Auto-Role Added')
      .setDescription(`New members will now receive <@&${roleId}>`)

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'autorole-remove') {
    const roleId = getOpt('role')
    const config = await loadGuildConfig(guildId)

    if (!config.autoRoles.includes(roleId)) {
      return res.json({
        type: 4,
        data: { content: 'That role is not in the list.', flags: 64 },
      })
    }

    config.autoRoles = config.autoRoles.filter((id) => id !== roleId)
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle('Auto-Role Removed')
      .setDescription(`<@&${roleId}> will no longer be assigned to new members`)

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'autorole-list') {
    const config = await loadGuildConfig(guildId)

    if (!config.autoRoles.length) {
      return res.json({
        type: 4,
        data: { content: 'No auto-roles configured.', flags: 64 },
      })
    }

    const roleList = config.autoRoles.map((id) => `<@&${id}>`).join('\n')
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('Auto-Assign Roles')
      .setDescription(roleList)

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }

  if (sub === 'dm') {
    const enabled = getOpt('enabled')
    const config = await loadGuildConfig(guildId)

    config.dmEnabled = enabled
    await setGuildConfig(guildId, config)

    const embed = new EmbedBuilder()
      .setColor(enabled ? 0x57f287 : 0xed4245)
      .setTitle('Welcome DM Updated')
      .setDescription(`Welcome DMs are now **${enabled ? 'enabled' : 'disabled'}**`)

    return res.json({ type: 4, data: { embeds: [embed.toJSON()], flags: 64 } })
  }
}
