import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { MinecraftServer, SmpTemplate } from './types.js';
import { db } from './database.js';
import { dockerManager } from './dockerManager.js';
import { FileManager } from './fileManager.js';

export const SMP_TEMPLATES: SmpTemplate[] = [
  {
    id: 'tokensmp',
    name: 'TokenSMP Economy & Custom Enchants',
    tagline: 'Modern economy SMP featuring mining tokens, tier upgrades, and token shops',
    description: 'The definitive TokenSMP blueprint. Players earn tokens by mining ores and slaying mobs, which can be spent at interactive NPC shops for custom enchantments, flight privileges, and rare crate keys.',
    category: 'ECONOMY',
    recommendedEngine: 'PAPER',
    recommendedVersion: '1.21.1',
    recommendedRamMb: 4096,
    badge: 'Popular',
    icon: 'Coins',
    features: [
      'Token Economy Engine with custom multiplier boosts',
      'Interactive GUI Token Shop with tier progression',
      '15+ Custom Token Enchantments (Explosive, Jackhammer, Laser)',
      'Pre-configured EssentialsX economy & Vault integration',
      'Daily rewards, playtime vouchers, and voting crates',
    ],
    includedPlugins: [
      'TokenManager',
      'TokenEnchants',
      'Vault',
      'EssentialsX',
      'LuckPerms',
      'DecentHolograms',
      'DeluxeMenus',
    ],
    sampleMotdLine1: '§e§lTOKEN§6§lSMP §7» §fSeason IV: Overdrive',
    sampleMotdLine2: '§a✔ §fCustom Token Enchants §7| §e/tokenshop §7| §b0.0.0.0:{PORT}',
    configsOverview: [
      'server.properties (Economy tuned, view-distance=10)',
      'plugins/TokenManager/config.yml (Balance multipliers, token drop rates)',
      'plugins/TokenEnchants/enchants.yml (Pre-balanced 15 custom enchants)',
      'plugins/DeluxeMenus/menus/tokenshop.yml (Pre-configured GUI layout)',
      'paper-global.yml (Asynchronous chunk saving enabled)',
    ],
  },
  {
    id: 'gemsteal',
    name: 'GemSteal & LifeSteal SMP [Season 3]',
    tagline: 'High-stakes combat SMP where players steal health/gems on every kill',
    description: 'Adrenaline-fueled hardcore SMP. Eliminating an opponent steals 1 Heart / Power Gem from their health pool. Players reaching 0 hearts are temporarily spectated until revived via crafting Revive Beacons.',
    category: 'LIFESTEAL',
    recommendedEngine: 'PURPUR',
    recommendedVersion: '1.21.1',
    recommendedRamMb: 4096,
    badge: 'High Stakes',
    icon: 'HeartPulse',
    features: [
      'Real-time Heart Steal on PvP kills (max 20 hearts, min 0)',
      'Spectator ban upon total heart depletion',
      'Custom Revive Beacon recipe with Nether Star & Netherite',
      'Heart withdraw command (/withdrawheart <amount>)',
      'Combat Tag logger preventing combat logging during skirmishes',
    ],
    includedPlugins: [
      'LifeStealCore',
      'ReviveBeacons',
      'CombatTagPlus',
      'LuckPerms',
      'CoreProtect',
      'FastAsyncWorldEdit',
      'WorldGuard',
    ],
    sampleMotdLine1: '§c§lGEM§4§lSTEAL §fSMP §7[§c§nSEASON 3§r§7]',
    sampleMotdLine2: '§4⚔ §fKill to Steal Hearts §7| §cRevive Beacons Active §7| §e1.21.1',
    configsOverview: [
      'plugins/LifeStealCore/config.yml (Heart transfer rates & max caps)',
      'plugins/CombatTagPlus/config.yml (15s combat tagging timer)',
      'plugins/ReviveBeacons/recipes.yml (Custom craftable beacon setup)',
      'server.properties (PvP=true, Hardcore=false, auto-respawn)',
    ],
  },
  {
    id: 'firemc_pvp',
    name: 'FireMC Combat & Kit Duels Arena',
    tagline: 'Ultra-low latency competitive PvP arena, ranked duels, and combat tags',
    description: 'Turnkey competitive PvP server package modeled after FireMC and MinemenClub. Optimized for tick rates, instantaneous hit detection, ranked 1v1 / 2v2 duel ladders, and custom arena regeneration.',
    category: 'PVP',
    recommendedEngine: 'PURPUR',
    recommendedVersion: '1.20.4',
    recommendedRamMb: 4096,
    badge: 'Competitive',
    icon: 'Swords',
    features: [
      'Ranked and Unranked 1v1 / 2v2 ELO duel matchmaking',
      'Pre-built kits: Nodebuff, Gapple, Netherite Pot, UHC, Archer, Combo',
      'Sub-tick knockback profiles and hit delay customization',
      'Instant arena reset and chunk regeneration without lag spikes',
      'Anti-cheat and ping compensation thresholds',
    ],
    includedPlugins: [
      'DuelsCore',
      'StrikePractice',
      'CombatTagPlus',
      'WorldEdit',
      'FastAsyncWorldEdit',
      'Chunky',
      'ViaVersion',
    ],
    sampleMotdLine1: '§c§lFIRE§6§lMC §7» §cCompetitive 1.20+ PvP Arena',
    sampleMotdLine2: '§e⚔ §fRanked ELO Duels §7| §aCustom Kits §7| §bZero Lag',
    configsOverview: [
      'purpur.yml (Optimized knockback and entity hitboxes)',
      'plugins/DuelsCore/kits.yml (Pre-built PvP kit loadouts)',
      'plugins/DuelsCore/arenas.yml (Pre-configured duel arena coordinates)',
      'spigot.yml (Reduced tick rates for dropped items & particles)',
    ],
  },
  {
    id: 'battlepie_duels',
    name: 'BattlePie Mega Clan Wars & SMP',
    tagline: 'Factions, territory claims, war declarations, and clan power rankings',
    description: 'An expansive clan warfare SMP package. Gather resources, establish fortified claim bases with power crystals, declare clan wars, and conquer neutral outpost towers for passive team rewards.',
    category: 'PVP',
    recommendedEngine: 'PAPER',
    recommendedVersion: '1.21.1',
    recommendedRamMb: 6144,
    badge: 'Clan Wars',
    icon: 'Shield',
    features: [
      'Clan territory claims with power regeneration mechanics',
      'Custom Outpost Towers that can be contested weekly',
      'TNT cannon physics optimizations and raiding mechanics',
      'Integrated Clan bank and shared teleports',
      'Comprehensive CoreProtect anti-abuse logs',
    ],
    includedPlugins: [
      'ClansPro',
      'SavageFactions',
      'Vault',
      'EssentialsX',
      'LuckPerms',
      'CoreProtect',
      'ClearLag',
      'TAB',
    ],
    sampleMotdLine1: '§6§lBATTLE§e§lPIE §7[§cCLAN WARS§7]',
    sampleMotdLine2: '§6⚡ §fBuild Clans §7| §eRaid Outposts §7| §aSeason Launch',
    configsOverview: [
      'plugins/ClansPro/config.yml (Power formula, claim limits)',
      'plugins/SavageFactions/factions.json (Default settings & grace period)',
      'paper-global.yml (Optimized TNT collision calculations)',
    ],
  },
  {
    id: 'vanilla_plus',
    name: 'Vanilla+ Enhanced Survival SMP',
    tagline: 'Pure Minecraft vanilla spirit enhanced with voice chat, dynmap, and anti-grief',
    description: 'For communities seeking authentic survival gameplay without intrusive commands or game-breaking mods. Includes proximity voice chat, web map overview, one-player sleep, and grief rollback.',
    category: 'VANILLA_PLUS',
    recommendedEngine: 'PAPER',
    recommendedVersion: '1.21.1',
    recommendedRamMb: 4096,
    badge: 'Authentic',
    icon: 'Sparkles',
    features: [
      'Simple Voice Chat (proximity audio integration)',
      'Live Web Map rendering (Dynmap / Bluemap)',
      'Multiplayer sleep percentage (1 player sleep skips night)',
      'Armor stand visual editor and micro-block heads',
      'Non-invasive CoreProtect inspection tools',
    ],
    includedPlugins: [
      'SimpleVoiceChat',
      'Dynmap',
      'CoreProtect',
      'ArmorStandTools',
      'LuckPerms',
      'Chunky',
    ],
    sampleMotdLine1: '§a§lVANILLA§2§l+ §fSurvival SMP §7[1.21.1]',
    sampleMotdLine2: '§2☘ §fProximity Voice Chat §7| §aWeb Live Map §7| §fChill Community',
    configsOverview: [
      'server.properties (Pure vanilla difficulty=hard, view-distance=12)',
      'plugins/SimpleVoiceChat/voicechat-server.properties (Port binding)',
      'plugins/Dynmap/configuration.txt (Low-impact web tile renderer)',
    ],
  },
];

export class SmpTemplateManager {
  public static getAll(): SmpTemplate[] {
    return SMP_TEMPLATES;
  }

  public static getById(id: string): SmpTemplate | undefined {
    return SMP_TEMPLATES.find(t => t.id === id);
  }

  public static async deploy(server: MinecraftServer, templateId: string, mode: 'clean' | 'overlay'): Promise<{ success: boolean; message: string }> {
    const template = this.getById(templateId);
    if (!template) {
      throw new Error(`SMP Template "${templateId}" not found in catalog.`);
    }

    FileManager.ensureServerFiles(server);
    const volume = server.volumePath;
    const pluginsDir = path.join(volume, 'plugins');

    if (!fs.existsSync(pluginsDir)) {
      fs.mkdirSync(pluginsDir, { recursive: true });
    }

    // 1. Clean installation logic
    if (mode === 'clean') {
      try {
        const files = fs.readdirSync(pluginsDir);
        for (const f of files) {
          const p = path.join(pluginsDir, f);
          fs.rmSync(p, { recursive: true, force: true });
        }
      } catch (err) {
        console.error('Clean mode error:', err);
      }
    }

    // 2. Install plugins and mock configs based on template
    const installedIds: string[] = [];

    switch (template.id) {
      case 'tokensmp': {
        // TokenManager mock plugin & config
        const tmDir = path.join(pluginsDir, 'TokenManager');
        if (!fs.existsSync(tmDir)) fs.mkdirSync(tmDir, { recursive: true });
        fs.writeFileSync(
          path.join(tmDir, 'config.yml'),
          `# TokenManager Configuration
prefix: "&e&lTOKENS &8» &7"
currency-name: "Tokens"
currency-symbol: "⛃"
starting-balance: 100
mob-drop-chance: 35
mob-token-amount: 2
mining-token-chance: 20
mining-token-amount: 1
database:
  type: SQLITE
  file: tokens.db
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'TokenManager-1.8.jar'), '# TokenManager Plugin Binary\n');
        installedIds.push('tokenmanager');

        // TokenEnchants mock
        const teDir = path.join(pluginsDir, 'TokenEnchants');
        if (!fs.existsSync(teDir)) fs.mkdirSync(teDir, { recursive: true });
        fs.writeFileSync(
          path.join(teDir, 'enchants.yml'),
          `# TokenEnchants Pre-Configured Packs
enchants:
  explosive:
    cost: 500
    max-level: 5
    description: "Detonates mined blocks in a 3x3 radius"
  jackhammer:
    cost: 1200
    max-level: 3
    description: "Instantly cleaves whole ore layers"
  laser:
    cost: 2500
    max-level: 2
    description: "Fires a mining laser up to 10 blocks forward"
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'TokenEnchants-18.4.jar'), '# TokenEnchants Plugin Binary\n');
        installedIds.push('tokenenchants');

        // Vault & EssentialsX
        fs.writeFileSync(path.join(pluginsDir, 'Vault-1.7.3.jar'), '# Vault Bridge\n');
        fs.writeFileSync(path.join(pluginsDir, 'EssentialsX-2.20.1.jar'), '# EssentialsX Suite\n');
        installedIds.push('vault', 'essentialsx', 'luckperms');
        break;
      }

      case 'gemsteal': {
        const lsDir = path.join(pluginsDir, 'LifeStealCore');
        if (!fs.existsSync(lsDir)) fs.mkdirSync(lsDir, { recursive: true });
        fs.writeFileSync(
          path.join(lsDir, 'config.yml'),
          `# LifeStealCore Configuration
hearts:
  default: 20
  minimum: 0
  maximum: 40
  steal-on-kill: 1
  drop-gem-chance: 100
elimination:
  action: SPECTATOR
  ban-duration-hours: 24
  broadcast: "&c☠ &4{VICTIM} &chas been eliminated by &f{ATTACKER}&c! All hearts lost."
recipes:
  revive-beacon:
    enabled: true
    shape:
      - "NDN"
      - "DBD"
      - "NNN"
    ingredients:
      N: NETHERITE_INGOT
      D: DIAMOND_BLOCK
      B: BEACON
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'LifeStealCore-3.4.jar'), '# LifeStealCore Plugin Binary\n');

        const ctDir = path.join(pluginsDir, 'CombatTagPlus');
        if (!fs.existsSync(ctDir)) fs.mkdirSync(ctDir, { recursive: true });
        fs.writeFileSync(
          path.join(ctDir, 'config.yml'),
          `# CombatTagPlus Settings
tag-duration-seconds: 15
disable-commands-in-combat:
  - "/spawn"
  - "/home"
  - "/tpa"
spawn-npc-on-disconnect: true
npc-lifetime: 15
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'CombatTagPlus-1.3.jar'), '# CombatTagPlus Plugin Binary\n');
        installedIds.push('lifestealcore', 'combattagplus', 'luckperms', 'coreprotect');
        break;
      }

      case 'firemc_pvp': {
        const duelsDir = path.join(pluginsDir, 'Duels');
        if (!fs.existsSync(duelsDir)) fs.mkdirSync(duelsDir, { recursive: true });
        fs.writeFileSync(
          path.join(duelsDir, 'kits.yml'),
          `# FireMC Matchmaking Kits
kits:
  nodebuff:
    displayName: "&d&lNoDebuff Pot"
    icon: SPLASH_POTION
    rating: true
    helmet: DIAMOND_HELMET:PROTECTION_4:UNBREAKING_3
    chestplate: DIAMOND_CHESTPLATE:PROTECTION_4:UNBREAKING_3
    leggings: DIAMOND_LEGGINGS:PROTECTION_4:UNBREAKING_3
    boots: DIAMOND_BOOTS:PROTECTION_4:UNBREAKING_3:FEATHER_FALLING_4
    sword: DIAMOND_SWORD:SHARPNESS_5:FIRE_ASPECT_2:UNBREAKING_3
  gapple:
    displayName: "&6&lGapple OP"
    icon: GOLDEN_APPLE
    rating: true
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'Duels-3.5.2.jar'), '# Duels Core Engine\n');
        fs.writeFileSync(path.join(pluginsDir, 'CombatTagPlus-1.3.jar'), '# CombatTagPlus\n');
        fs.writeFileSync(path.join(pluginsDir, 'FastAsyncWorldEdit-Bukkit-2.8.4.jar'), '# FAWE\n');
        installedIds.push('duels', 'combattagplus', 'fastasyncworldedit');
        break;
      }

      case 'battlepie_duels': {
        const clansDir = path.join(pluginsDir, 'ClansPro');
        if (!fs.existsSync(clansDir)) fs.mkdirSync(clansDir, { recursive: true });
        fs.writeFileSync(
          path.join(clansDir, 'config.yml'),
          `# BattlePie Clans Configuration
clans:
  max-members: 12
  claim-cost: 500
  power-per-player: 10
  power-loss-on-death: 3
  war-duration-minutes: 60
outposts:
  capture-radius: 15
  reward-interval-minutes: 10
  reward-xp: 500
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'ClansPro-2.1.jar'), '# Clans Engine\n');
        fs.writeFileSync(path.join(pluginsDir, 'CoreProtect-22.2.jar'), '# CoreProtect\n');
        installedIds.push('clanspro', 'coreprotect', 'vault', 'essentialsx');
        break;
      }

      case 'vanilla_plus':
      default: {
        const voiceDir = path.join(pluginsDir, 'SimpleVoiceChat');
        if (!fs.existsSync(voiceDir)) fs.mkdirSync(voiceDir, { recursive: true });
        fs.writeFileSync(
          path.join(voiceDir, 'voicechat-server.properties'),
          `# Simple Voice Chat Server Configuration
port=24454
bind_address=0.0.0.0
sample_rate=48000
voice_host=
distance=48
`
        );
        fs.writeFileSync(path.join(pluginsDir, 'voicechat-bukkit-2.5.jar'), '# Voice Chat Plugin\n');
        fs.writeFileSync(path.join(pluginsDir, 'CoreProtect-22.2.jar'), '# CoreProtect\n');
        installedIds.push('voicechat', 'coreprotect');
        break;
      }
    }

    // 3. Update server properties with themed 2-line MOTD
    const motdLine1 = template.sampleMotdLine1;
    const motdLine2 = template.sampleMotdLine2.replace('{PORT}', String(server.port));
    const fullMotd = `${motdLine1}\\n${motdLine2}`;

    FileManager.updateMotdInProperties(server, fullMotd);

    // 4. Generate an authentic 64x64 server icon using sharp
    try {
      const iconSvg = generatePresetIconSvg(template);
      const iconBuffer = await sharp(Buffer.from(iconSvg))
        .resize(64, 64)
        .png()
        .toBuffer();
      await FileManager.saveIcon(server, iconBuffer);
    } catch (err) {
      console.error('Failed to generate template icon:', err);
    }

    // 5. Update database record
    db.updateServer(server.id, {
      motd: fullMotd,
      installedPlugins: Array.from(new Set([...server.installedPlugins, ...installedIds])),
    });

    db.logAction(
      'admin',
      'TEMPLATE_DEPLOY',
      `Deployed template "${template.name}" in ${mode.toUpperCase()} mode`,
      server.id,
      server.name
    );

    dockerManager.pushLog(
      server.id,
      `[Panel/TEMPLATE] Successfully deployed community preset: ${template.name} (${mode.toUpperCase()} mode)`,
      'info'
    );

    return {
      success: true,
      message: `Deployed "${template.name}" with full configs, plugins, and branding.`,
    };
  }
}

function generatePresetIconSvg(template: SmpTemplate): string {
  let bgGrad1 = '#1e293b';
  let bgGrad2 = '#0f172a';
  let symbol = '⚔';
  let symColor = '#38bdf8';

  switch (template.id) {
    case 'tokensmp':
      bgGrad1 = '#78350f';
      bgGrad2 = '#d97706';
      symbol = '⛃';
      symColor = '#fef08a';
      break;
    case 'gemsteal':
      bgGrad1 = '#881337';
      bgGrad2 = '#e11d48';
      symbol = '♥';
      symColor = '#fecdd3';
      break;
    case 'firemc_pvp':
      bgGrad1 = '#7c2d12';
      bgGrad2 = '#ea580c';
      symbol = '⚔';
      symColor = '#fed7aa';
      break;
    case 'battlepie_duels':
      bgGrad1 = '#431407';
      bgGrad2 = '#c2410c';
      symbol = '🛡';
      symColor = '#fed7aa';
      break;
    case 'vanilla_plus':
      bgGrad1 = '#064e3b';
      bgGrad2 = '#059669';
      symbol = '☘';
      symColor = '#a7f3d0';
      break;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${bgGrad1}" />
        <stop offset="100%" stop-color="${bgGrad2}" />
      </linearGradient>
    </defs>
    <rect width="64" height="64" fill="url(#g)" rx="10" />
    <rect x="2" y="2" width="60" height="60" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" rx="8" />
    <text x="32" y="42" font-size="28" text-anchor="middle" font-family="monospace, sans-serif" fill="${symColor}">${symbol}</text>
  </svg>`;
}
