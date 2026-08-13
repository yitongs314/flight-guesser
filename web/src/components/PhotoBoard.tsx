import { useI18n } from '../i18n';
import type { PhotoBoardDTO } from '../types';

interface Props {
  gameId: string;
  /** Cache-busts tile URLs so a new flight in the same match never shows the
   * previous flight's cached tiles. */
  flightIndex: number;
  board: PhotoBoardDTO;
  disabled: boolean;
  /** Remaining potential score, to grey out tiles the player can't afford. */
  budget: number;
  onBuy: (tile: number) => void;
}

/**
 * The masked aircraft photo. Click a masked tile to buy it. Only revealed
 * tiles are ever fetched — each is a server-side crop, so the full image never
 * reaches the client until the flight is resolved.
 */
export default function PhotoBoard({ gameId, flightIndex, board, disabled, budget, onBuy }: Props) {
  const { lang } = useI18n();
  const tiles = Array.from({ length: board.cols * board.rows }, (_, i) => i);
  const firstFree = board.revealed.length === 0;
  const affordable = firstFree || budget - board.tilePrice >= 100;
  const priceTip = firstFree
    ? lang === 'zh'
      ? '第一块免费！'
      : 'First tile is free!'
    : lang === 'zh'
      ? `揭开这一块（−${board.tilePrice} 分）`
      : `Reveal this tile (−${board.tilePrice} pts)`;
  return (
    <div
      className="photo-board"
      style={{
        aspectRatio: `${board.width} / ${board.height}`,
        // Cap effective height so the game page never scrolls.
        width: `min(100%, calc(46vh * ${board.width / board.height}))`,
        margin: '0 auto',
      }}
    >
      {tiles.map((i) => {
        const revealed = board.revealed.includes(i);
        const col = i % board.cols;
        const row = Math.floor(i / board.cols);
        const style = {
          left: `${(col / board.cols) * 100}%`,
          top: `${(row / board.rows) * 100}%`,
          width: `${100 / board.cols}%`,
          height: `${100 / board.rows}%`,
        };
        return revealed ? (
          <div key={i} className="pb-tile shown" style={style}>
            <img src={`/api/games/${gameId}/tiles/${i}?f=${flightIndex}`} alt="" />
          </div>
        ) : (
          <button
            key={i}
            className="pb-tile pb-buyable"
            style={style}
            title={priceTip}
            disabled={disabled || !affordable}
            onClick={() => onBuy(i)}
          />
        );
      })}
    </div>
  );
}
