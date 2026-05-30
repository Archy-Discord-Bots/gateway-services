import { readJSON, writeJSON } from './hfClient.js'

const guildCache = new Map()

export function getGuildConfig(guildId) {
  return guildCache.get(guildId) ?? null
}

export async function setGuildConfig(guildId, config) {
  guildCache.set(guildId, config)
  await writeJSON(`guilds/${guildId}/config.json`, config)
  return config
}

export async function loadGuildConfig(guildId) {
  const cached = guildCache.get(guildId)
  if (cached) return cached

  const stored = await readJSON(`guilds/${guildId}/config.json`)
  if (stored !== null) {
    guildCache.set(guildId, stored)
    return stored
  }

  return initGuildConfig(guildId)
}

export async function initGuildConfig(guildId) {
  const config = {
    guildId,
    welcomeChannelId: null,
    leaveChannelId: null,
    autoRoles: [],
    welcomeMessage: 'Welcome {user} to {server}! You are member #{count}.',
    leaveMessage: '{user} has left the server. We now have {count} members.',
    dmMessage:
      'Hey {username}, really glad you made it to {server}.\n\nTake a look around and feel free to jump into any conversation.\n\nIf you need anything, the team is around.',
    dmEnabled: true,
    welcomeBackground: 'default1',
    leaveBackground: 'default1',
    cardTextColor: '#ffffff',
    cardAccentColor: '#5865F2',
    createdAt: new Date().toISOString(),
  }

  return setGuildConfig(guildId, config)
}

export function deleteGuildConfig(guildId) {
  guildCache.delete(guildId)
}

export async function getMemberData(guildId, userId) {
  return readJSON(`guilds/${guildId}/members/${userId}.json`)
}

export async function setMemberData(guildId, userId, data) {
  await writeJSON(`guilds/${guildId}/members/${userId}.json`, data)
}

export async function initMemberData(guildId, userId, username) {
  const record = {
    userId,
    username,
    guildId,
    joinedAt: new Date().toISOString(),
    leftAt: null,
    joinCount: 1,
    xp: 0,
    level: 0,
    messageCount: 0,
    roles: [],
    warnings: 0,
    dmSent: false,
  }

  await setMemberData(guildId, userId, record)
  return record
}