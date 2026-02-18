import { GoogleGenAI } from "@google/genai";
import { PokerGameState, Card } from '../game/pokerTypes';

const formatCards = (cards: Card[]) => cards.map(c => `${c.rank}${c.suit}`).join(' ');

export const getStrategicAdvice = async (gameState: PokerGameState): Promise<string> => {
  if (!process.env.API_KEY) {
    return "缺少 API 密钥。请检查您的环境配置。";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const userPlayer = gameState.players.find(p => p.isUser);
  const position = userPlayer?.positionName || '未知';
  const stack = userPlayer?.chips || 0;
  
  const communityCardsStr = gameState.communityCards.length > 0 
    ? formatCards(gameState.communityCards) 
    : '无';

  // Summarize recent actions
  const recentActions = gameState.actionLog
    .filter(a => a.phase === gameState.phase)
    .map(a => {
        const p = gameState.players.find(pl => pl.id === a.playerId);
        return `${p?.positionName}${p?.isUser ? '(我)' : ''}: ${a.type}${a.amount ? ` ${a.amount}` : ''}`;
    })
    .join(', ');

  const prompt = `
    你是一位利用 GTO（博弈论最优）策略的世界级德州扑克教练。
    
    当前游戏状态：
    - 阶段: ${gameState.phase}
    - 玩家人数: ${gameState.playerCount}
    - 你的位置: ${position}
    - 你的筹码: ${stack}
    - 你的手牌: ${formatCards(gameState.userCards)}
    - 公共牌: ${communityCardsStr}
    - 底池大小: ${gameState.pot}
    - 当前跟注所需: ${gameState.currentHighBet - (userPlayer?.roundBet || 0)}
    - 本阶段动作流: ${recentActions || '无 (你是第一个行动)'}

    任务：
    请提供极简的决策建议，重点在于行动。格式如下：

    **建议行动：[行动]** (如：**过牌**、**跟注**、**加注至 XX**)

    *   **理由**：[一句话概括，结合牌力、赔率或对手范围]
    *   **关键点**：[胜率估算或特别注意的风险，非必须可省略]

    要求：
    1. 不要长篇大论，直接给出结论。
    2. 将复杂的数学计算（如底池赔率、范围分析）内化在理由中，不要单独列出计算过程。
    3. 风格干练、专业。
    4. 使用中文。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep thought for real-time play
      }
    });
    return response.text || "未能生成建议。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "生成建议时出错。请重试。";
  }
};