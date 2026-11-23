import type { ReactNode } from "react";
import styles from "./chat-home.module.css";

type Props = {
  /** A quiet line above the question: "Bom dia, Helena". */
  greeting: string;
  portrait?: ReactNode;
  /** The question the screen asks: it is the title. */
  headline: string;
  /** The request box, in the middle of the screen. */
  composer: ReactNode;
};

/** The column a conversation is read in, once it started: centred, never wider than a text. */
export function ChatThread({ children }: { children: ReactNode }) {
  return <div className={styles.thread}>{children}</div>;
}

/**
 * The opening of the chat, before the first request: the greeting, one question and the request
 * box. Nothing else: what waits for the person and the lists of the product live in their own
 * screens. New in this project; it goes to the Design System after the interface is approved.
 */
export function ChatHome({ greeting, portrait, headline, composer }: Props) {
  return (
    <div className={styles.home}>
      <div className={styles.glow} aria-hidden="true" />
      <div className={styles.scroll}>
        <div className={styles.column}>
          <header className={styles.hello}>
            {portrait}
            <p className={styles.greeting}>{greeting}</p>
            <h1 className={styles.headline}>{headline}</h1>
          </header>
          <div className={styles.ask}>{composer}</div>
        </div>
      </div>
    </div>
  );
}
