import type { Lang } from "./lang";

// Localized name/description overrides for game content (bobs, ropes, sites,
// shapes, skins, modifiers), keyed by the def `id`. English lives in the data
// files themselves, so only non-English languages need entries here; anything
// missing falls back to the English def.
export type ContentCategory =
  | "pendulum"
  | "attachment"
  | "site"
  | "skin"
  | "shape"
  | "modifier"
  | "token"
  | "maneuver";

type Entry = { name: string; description: string };
type CategoryDict = Record<string, Entry>;
type ContentDict = Record<ContentCategory, CategoryDict>;

const ptContent: ContentDict = {
  pendulum: {
    "wooden-bob": {
      name: "Bob de Madeira",
      description:
        "Pequeno e leve. Balança rápido, mas o alcance curto só pega os multiplicadores mais próximos.",
    },
    "brass-bob": {
      name: "Bob de Latão",
      description:
        "Tamanho médio e um pouco mais lento que o de madeira, com área maior para pegar mais zonas em cada balanço.",
    },
    "iron-bob": {
      name: "Bob de Ferro",
      description:
        "Grande e pesado. Demora para embalar, mas o alcance enorme pega multiplicadores que bobs menores nem encostam.",
    },
    "twin-bob": {
      name: "Bob Duplo",
      description:
        "Dois bobs leves na mesma linha. Rápidos para o tamanho e com um arco que um bob só não cobre.",
    },
    "triple-bob": {
      name: "Bob Triplo",
      description:
        "Três bobs na mesma linha. Cobertura absurda do começo ao fim do balanço.",
    },
    "tungsten-heavy": {
      name: "Tungstênio Pesado",
      description:
        "Denso como núcleo de planeta. Passa varrendo uma área enorme; quase nenhuma zona fica segura.",
    },
    "ravager-bob": {
      name: "Bob Devastador",
      description:
        "Quando a corda arrebenta, ele não sai voando à toa: ele caça. Persegue os multiplicadores mais próximos e devora um por um até se satisfazer.",
    },
    "piercer-bob": {
      name: "Bob Perfurador",
      description:
        "Balança muito rápido e, de tempos em tempos, dispara em linha reta atravessando uma fileira inteira de círculos.",
    },
    "hydra-bob": {
      name: "Bob Hidra",
      description:
        "Um mutante que cresce conforme pontua. A cada marco de combo, ganha uma nova cabeça pelo resto da rodada.",
    },
    "nitro-bob": {
      name: "Bob Nitro",
      description:
        "Arriscado e explosivo. Tem alcance e pontuação enormes, mas gasta a corda muito rápido. Remendos salvam a rodada.",
    },
    "lodestone-bob": {
      name: "Bob Magnetita",
      description:
        "Um ímã no barbante. Multiplicadores e fichas por perto puxam para o arco dele, deixando tudo mais fácil de pegar.",
    },
    "frenzy-bob": {
      name: "Bob Frenesi",
      description:
        "Quanto maior o combo, mais rápido e maior ele fica. Quebre a sequência e ele volta ao normal.",
    },
    "tp-bob": {
      name: "Bob TP",
      description:
        "Não para no lugar. Teleporta para pontos aleatórios do campo e a linha puxa de volta: curta traz com força, longa deixa passear.",
    },
    "rocket-bob": {
      name: "Bob Foguete",
      description:
        "Nada de impulso inicial: ele liga o motor e acelera durante a rodada. Fica ainda melhor com Rampa de Velocidade.",
    },
    "breakable-bob": {
      name: "Bob Quebrável",
      description:
        "Começa enorme e pesado, mas cada acerto solta um fragmento que pontua sozinho. Quanto mais quebra, mais leve e rápido fica.",
    },
    "chaos-bob": {
      name: "Bob do Caos",
      description:
        "Nunca se comporta igual. Tamanho, peso, velocidade e alcance mudam o tempo todo. Pura aposta, puro espetáculo.",
    },
  },
  attachment: {
    "micro-twine": {
      name: "Barbante Micro",
      description: "Barbante minúsculo. Arcos curtos e tensos; os acertos vêm rápido.",
    },
    "short-hemp": {
      name: "Cânhamo Curto",
      description: "Linha curta de cânhamo. Balanço rápido com alcance modesto.",
    },
    "compact-rope": {
      name: "Corda Compacta",
      description: "Corda média-curta. Bom equilíbrio entre velocidade e alcance.",
    },
    "hemp-rope": {
      name: "Corda de Cânhamo",
      description: "Corda flexível básica. Fácil de controlar.",
    },
    "steel-rope": {
      name: "Cabo de Aço",
      description: "Cabo de aço bem esticado. Responde mais rápido.",
    },
    "braided-rope": {
      name: "Corda Trançada",
      description: "Linha trançada mais longa. Arcos amplos e momentum estável.",
    },
    "tow-rope": {
      name: "Corda de Reboque",
      description: "Linha de reboque pesada. Balanços grandes e muito impulso.",
    },
    "titan-cable": {
      name: "Cabo Titã",
      description: "Cabo gigantesco. Começa lento, mas varre uma área enorme.",
    },
    "magnetic-tether": {
      name: "Amarra Magnética",
      description: "Um campo magnético invisível. Alcance absurdo.",
    },
    "mechanic-belt": {
      name: "Esteira Mecânica",
      description:
        "Um túnel transportador com paredes sólidas. Cada rodada sorteia um caminho novo; o bob entra com força e desliza pelo tubo. Se perder velocidade, a aderência acaba e ele quica até a saída. Remendos recarregam a esteira.",
    },
    "flux-cord": {
      name: "Cordão de Fluxo",
      description:
        "Uma linha instável. Alcance e desgaste mudam durante a rodada; nunca é o mesmo balanço duas vezes.",
    },
    "pendulum-line": {
      name: "Linha de Pêndulo",
      description:
        "Uma haste rígida que encurta e alonga em ritmo constante. É pêndulo de verdade, não corda solta.",
    },
    "bulwark-weave": {
      name: "Trança Baluarte",
      description:
        "De tempos em tempos, um trecho endurece e vira parede. Não pega remendos, mas uma pancada forte quebra a parede e repara a linha.",
    },
    "iron-rod": {
      name: "Haste de Ferro",
      description: "Haste rígida de metal. Giro forte e preciso.",
    },
    "heavy-chain": {
      name: "Corrente Pesada",
      description: "Corrente pesada. Dá inércia a cada balanço.",
    },
    "elastic-cord": {
      name: "Cordão Elástico",
      description: "Cordão esticável. Acumula energia antes de soltar.",
    },
  },
  site: {
    workshop: {
      name: "Oficina",
      description:
        "Bancada aberta, sem paredes segurando os bobs. Quando a corda arrebenta, eles saem voando; depois é só rodar de novo.",
    },
    "bumper-cage": {
      name: "Jaula de Para-choques",
      description:
        "Arena pequena com paredes. Depois que a corda arrebenta, os bobs ricocheteiam; bata forte numa parede para quebrar e ganhar impulso.",
    },
    "bumper-arena": {
      name: "Arena de Para-choques",
      description:
        "Arena média com paredes quebráveis. Mais espaço para os bobs ricochetearem antes de escapar.",
    },
    "bumper-colosseum": {
      name: "Coliseu de Para-choques",
      description:
        "Arena enorme com paredes quebráveis. Os bobs ficam ricocheteando por muito mais tempo antes de escapar.",
    },
    layers: {
      name: "As Camadas",
      description:
        "Um campo cercado por anéis com brechas giratórias. Multiplicadores aparecem entre as camadas; passe pelas aberturas para chegar nas zonas mais valiosas.",
    },
    "black-hole": {
      name: "Buraco Negro",
      description:
        "Um buraco negro fora do centro puxa tudo sem dó. As paredes impedem a fuga; leve o bob até o horizonte de eventos para jogar de novo da beira.",
    },
  },
  shape: {
    "classic-sphere": {
      name: "Esfera Clássica",
      description: "O bob redondo original. Simples, equilibrado e clássico.",
    },
    "brick-block": {
      name: "Bloco de Tijolo",
      description: "Massa quadrada e robusta. Bate como uma mini bigorna.",
    },
    "cut-gem": {
      name: "Gema Lapidada",
      description: "Diamante facetado com presença afiada.",
    },
    "nova-star": {
      name: "Estrela Nova",
      description: "Estrela de cinco pontas com cara de protagonista.",
    },
    "hex-nut": {
      name: "Porca Sextavada",
      description: "Ferragem industrial jogada direto no caos.",
    },
    "razor-triangle": {
      name: "Triângulo Navalha",
      description: "Cunha pontiaguda feita para arcos agressivos.",
    },
    "love-bomb": {
      name: "Bomba do Amor",
      description: "Destruição em forma de coração. Fofo até acertar.",
    },
    "thunder-bolt": {
      name: "Relâmpago",
      description: "Formato de raio, carregado de más decisões.",
    },
    "wild-flame": {
      name: "Chama Selvagem",
      description: "Formato de chama para quem gosta de caos quente.",
    },
    "steel-cog": {
      name: "Engrenagem de Aço",
      description: "Dentes de engrenagem com energia industrial.",
    },
    "holy-cross": {
      name: "Cruz Sagrada",
      description: "Um sinal de mais ousado. Julgamento na horizontal.",
    },
    "eclipse-moon": {
      name: "Lua de Eclipse",
      description: "Lua crescente com ameaça de céu noturno.",
    },
    "void-ring": {
      name: "Anel do Vazio",
      description: "Centro oco, impacto cheio.",
    },
  },
  skin: {
    "classic-oak": {
      name: "Carvalho Clássico",
      description: "Madeira entalhada e aconchegante. O visual inicial da oficina.",
    },
    "sunset-ember": {
      name: "Brasa do Pôr do Sol",
      description: "Acabamento de brasa que deixa um rastro quente no ar.",
    },
    "ocean-pearl": {
      name: "Pérola do Oceano",
      description: "Azul-petróleo perolado com brilho de fundo do mar.",
    },
    "cherry-blossom": {
      name: "Flor de Cerejeira",
      description: "Rosa suave com manchas delicadas como pétalas.",
    },
    "neon-pulse": {
      name: "Pulso Neon",
      description: "Listras elétricas que vibram a cada balanço.",
    },
    "frost-crystal": {
      name: "Cristal de Gelo",
      description: "Gelo facetado, frio e brilhante.",
    },
    "golden-comet": {
      name: "Cometa Dourado",
      description: "Ouro polido com uma faixa de cometa em chamas.",
    },
    "cosmic-void": {
      name: "Vazio Cósmico",
      description: "Preto de espaço profundo com pontos de luz distante.",
    },
    fireball: {
      name: "Bola de Fogo",
      description: "Núcleo de plasma cercado por chamas vivas.",
    },
    "dark-matter": {
      name: "Matéria Escura",
      description: "Roxo impossível que parece dobrar a luz.",
    },
    "plasma-storm": {
      name: "Tempestade de Plasma",
      description: "Arcos magenta e rastros de plasma ionizado.",
    },
    "toxic-slime": {
      name: "Gosma Tóxica",
      description: "Gosma verde radioativa com bolhas borbulhando.",
    },
    "lava-rock": {
      name: "Rocha de Lava",
      description: "Obsidiana rachada com veios de lava.",
    },
    "aurora-wave": {
      name: "Onda Aurora",
      description: "Luzes de aurora dançando num céu polar.",
    },
    "rainbow-prism": {
      name: "Prisma Arco-íris",
      description: "Faixas coloridas refratadas em vidro.",
    },
    "glitch-core": {
      name: "Núcleo Glitch",
      description: "Estática RGB rasgando pixels corrompidos.",
    },
    "blood-moon": {
      name: "Lua de Sangue",
      description: "Superfície lunar carmesim com brilho sinistro.",
    },
    "ghost-wisp": {
      name: "Fogo-fátuo",
      description: "Redemoinhos ectoplasmáticos e rastros fantasmagóricos.",
    },
    "black-hole": {
      name: "Buraco Negro",
      description: "Disco de acreção girando rumo ao horizonte de eventos.",
    },
    radioactive: {
      name: "Radioativo",
      description: "Listras de perigo neon e símbolo radioativo pulsante.",
    },
    "candy-swirl": {
      name: "Espiral de Doce",
      description: "Espiral colorida de pirulito hiperdoce.",
    },
    "thunder-core": {
      name: "Núcleo de Trovão",
      description: "Nuvem de tempestade cortada por relâmpagos.",
    },
    "matrix-code": {
      name: "Código Matrix",
      description: "Glifos verdes caindo sobre preto de terminal.",
    },
    "diamond-dust": {
      name: "Pó de Diamante",
      description: "Facetas geladas brilhando em fogo frio.",
    },
    "solar-flare": {
      name: "Erupção Solar",
      description: "Laços solares explodindo em uma superfície flamejante.",
    },
    "void-leech": {
      name: "Sanguessuga do Vazio",
      description: "Tentáculos drenando a cor da realidade.",
    },
    "holo-shimmer": {
      name: "Brilho Holo",
      description: "Brilho iridescente que muda de tom o tempo todo.",
    },
  },
  modifier: {
    "power-twist": {
      name: "Torção Potente",
      description: "+50% de força no giro por 7s.",
    },
    "heavy-air": {
      name: "Ar Pesado",
      description: "+25% de aceleração por 7s.",
    },
    featherweight: {
      name: "Peso-Pena",
      description: "-30% de massa do bob por 6s. Balança mais longe.",
    },
    "golden-hour": {
      name: "Hora Dourada",
      description: "x2 pontos por 5s.",
    },
    overdrive: {
      name: "Overdrive",
      description: "+75% de giro e +50% de pontos por 4s.",
    },
    "speed-ramp": {
      name: "Rampa de Velocidade",
      description: "A velocidade cresce até +40% ao longo de 7s.",
    },
    "tiny-bob": {
      name: "Bob Minúsculo",
      description: "-45% de tamanho por 7s. Passa por brechas apertadas.",
    },
    "bigger-bob": {
      name: "Bob Maior",
      description: "+20% de tamanho por 7s. Pega mais zonas.",
    },
    "giant-bob": {
      name: "Bob Gigante",
      description: "+40% de tamanho por 6s. Cobre um arco enorme.",
    },
    "velocity-surge": {
      name: "Surto de Velocidade",
      description: "Grande impulso de velocidade e +25% de giro por 5s.",
    },
    "multi-bob": {
      name: "Multi-Bob",
      description: "+2 ecos do bob acertam junto com você por 6s.",
    },
    "token-bonus": {
      name: "Bônus de Ficha",
      description: "x3 pontos e Bob jogado de novo.",
    },
  },
  token: {
    "bigger-bob": {
      name: "Bob Maior",
      description: "Aumenta o bob por 7s.",
    },
    "giant-bob": {
      name: "Bob Gigante",
      description: "Bob grande por 6s.",
    },
    "tiny-bob": {
      name: "Bob Minúsculo",
      description: "Encolhe o bob por 8s.",
    },
    "velocity-surge": {
      name: "Surto de Velocidade",
      description: "Dá um impulso forte no bob por 5s.",
    },
    "speed-ramp": {
      name: "Rampa de Velocidade",
      description: "A velocidade sobe até +40% ao longo de 8s.",
    },
    "multi-bob": {
      name: "Multi-Bob",
      description: "Cria ecos do bob que também pontuam por 6s.",
    },
    repair: {
      name: "Remendo",
      description: "Recupera a corda e adia o rompimento.",
    },
    golden: {
      name: "Ficha Dourada",
      description: "Joga o Bob de novo e dá x3 pontos.",
    },
  },
  maneuver: {
    fullRotation: {
      name: "Volta Completa",
      description: "Dê uma volta de 360 ao redor do pivô.",
    },
    highArc: {
      name: "Arco Alto",
      description: "Passe o bob acima do pivô.",
    },
    doubleSwing: {
      name: "Balanço Duplo",
      description: "Duas mudanças de direção em até 600ms.",
    },
    comboHit: {
      name: "Acerto de Combo",
      description: "+5 por nível de combo.",
    },
    perfectTwist: {
      name: "Torção Perfeita",
      description: "Torção alinhada à tangente do movimento.",
    },
  },
};

const CONTENT: Partial<Record<Lang, ContentDict>> = { pt: ptContent };

/** Localized name for a content def, falling back to the English `fallback`. */
export function locName(
  lang: Lang,
  category: ContentCategory,
  id: string,
  fallback: string
): string {
  return CONTENT[lang]?.[category]?.[id]?.name ?? fallback;
}

/** Localized description for a content def, falling back to the English `fallback`. */
export function locDesc(
  lang: Lang,
  category: ContentCategory,
  id: string,
  fallback: string
): string {
  return CONTENT[lang]?.[category]?.[id]?.description ?? fallback;
}
