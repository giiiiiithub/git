/**
 * Menu — IDEA-style context menu. Fixed-position popup at (x, y) with
 * viewport clamping, click-outside / Escape dismissal, and hover submenus.
 */
import { useLayoutEffect, useRef, useState } from "react";

export interface MenuItem {
  label: string;
  danger?: boolean;
  disabled?: boolean;
  /** When set, the item opens a hover submenu. */
  children?: MenuItem[];
  onClick?: () => void;
  /** Visual separator before this item. */
  separator?: boolean;
}

function MenuList(props: {
  items: MenuItem[];
  onClose: () => void;
  depth: number;
}): JSX.Element {
  const { items, onClose, depth } = props;
  const [sub, setSub] = useState<number | null>(null);
  const [subPos, setSubPos] = useState<{ x: number; y: number } | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  const openSub = (index: number): void => {
    const el = itemRefs.current[index];
    if (el === undefined || el === null) return;
    const rect = el.getBoundingClientRect();
    setSub(index);
    // Place right of the item; flip left when overflowing.
    const width = 200;
    const x = rect.right + width > window.innerWidth ? rect.left - width : rect.right;
    setSubPos({ x, y: Math.min(rect.top, window.innerHeight - 40) });
  };

  return (
    <div className="gitui-menu-list" role="menu">
      {items.map((item, index) => (
        <div key={index}>
          {item.separator === true && <div className="gitui-menu-sep" />}
          <div
            ref={(el) => {
              itemRefs.current[index] = el;
            }}
            role="menuitem"
            className={
              "gitui-menu-item" +
              (item.danger === true ? " gitui-menu-item-danger" : "") +
              (item.disabled === true ? " gitui-menu-item-disabled" : "") +
              (sub === index ? " gitui-menu-item-open" : "")
            }
            onClick={() => {
              if (item.disabled === true) return;
              if (item.children !== undefined) {
                if (sub === index) setSub(null);
                else openSub(index);
                return;
              }
              item.onClick?.();
              onClose();
            }}
            onMouseEnter={() => {
              if (item.children !== undefined) openSub(index);
              else if (sub !== null) setSub(null);
            }}
          >
            <span className="gitui-menu-label">{item.label}</span>
            {item.children !== undefined && <span className="gitui-menu-arrow">▸</span>}
          </div>
          {sub === index && item.children !== undefined && subPos !== null && (
            <div className="gitui-menu gitui-menu-sub" style={{ left: subPos.x, top: subPos.y }}>
              <MenuList items={item.children ?? []} onClose={onClose} depth={depth + 1} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function Menu(props: { x: number; y: number; items: MenuItem[]; onClose: () => void }): JSX.Element {
  const { x, y, items, onClose } = props;
  const rootRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (el !== null) {
      const rect = el.getBoundingClientRect();
      setPos({
        x: Math.min(x, Math.max(0, window.innerWidth - rect.width - 6)),
        y: Math.min(y, Math.max(0, window.innerHeight - rect.height - 6))
      });
    }
    const onDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y]);

  return (
    <div ref={rootRef} className="gitui-menu" style={{ left: pos.x, top: pos.y }}>
      <MenuList items={items} onClose={onClose} depth={0} />
    </div>
  );
}
