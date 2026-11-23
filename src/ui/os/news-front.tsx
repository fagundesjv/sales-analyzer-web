import type { LucideIcon } from "@content-ventures/design-system/v3/icons";
import type { ReactNode } from "react";
import styles from "./news-front.module.css";

/** How many tints the marks and the drawn covers take turns with. */
const TINTS = 7;

/** The same name always takes the same tint, so an outlet is known by its colour too. */
export function tintOf(name: string): number {
  let sum = 0;
  for (const letter of name) sum = (sum * 31 + (letter.codePointAt(0) ?? 0)) % 9973;
  return sum % TINTS;
}

type MarkProps = {
  /** Up to two letters that stand for the outlet. */
  letters: string;
  /** The name the tint is taken from. */
  name: string;
  size?: "sm" | "md" | "lg";
};

/** The mark of an outlet where its logo would be: its letters on its own tint. */
export function OutletMark({ letters, name, size = "md" }: MarkProps) {
  return (
    <span className={styles.mark} data-size={size} data-tint={tintOf(name)} aria-hidden="true">
      {letters}
    </span>
  );
}

type CoverProps = {
  /** The picture of the story, when the outlet ran one. */
  src?: string | null;
  /** What the picture shows; empty when the headline beside it already says it. */
  alt?: string;
  /** The outlet, for the cover drawn when there is no picture. */
  outlet: string;
  letters: string;
  ratio?: "2/1" | "16/9" | "4/3" | "1/1";
  /** A small picture beside a line of a list; without it the picture takes the room it has. */
  size?: "thumb";
};

/**
 * The picture of a story in a frame of a fixed shape. A story with no picture gets a cover
 * drawn from what is known of it, the letters of its outlet on the outlet's tint: never a
 * picture made up to look like a photo.
 */
export function NewsCover({ src, alt = "", outlet, letters, ratio = "16/9", size }: CoverProps) {
  return (
    <span className={styles.cover} data-ratio={ratio} data-size={size} data-tint={tintOf(outlet)}>
      {src ? (
        // biome-ignore lint/performance/noImgElement: an example picture, outside the image optimizer
        <img className={styles.picture} src={src} alt={alt} draggable={false} loading="lazy" />
      ) : (
        <span className={styles.drawn} aria-hidden="true">
          <span className={styles.drawnLetters}>{letters}</span>
          <span className={styles.drawnLines} />
        </span>
      )}
    </span>
  );
}

type StoryProps = {
  /** How much room the story takes: the lead of the page, a card of a row, or a small one. */
  variant: "lead" | "card" | "small";
  cover: ReactNode;
  /** The outlet and when the story arrived, above the headline. */
  kicker: ReactNode;
  title: string;
  /** The opening of the story, under the headline; the lead and the larger cards show it. */
  dek?: string;
  /** Quiet marks under the text, each one apart: how well it fits, who else ran it. */
  marks?: ReactNode[];
  /** What to do with the story, at its foot. */
  actions?: ReactNode;
  /** Opens the story; the whole card answers the click. */
  onOpen: () => void;
};

/** One story on the front page: its picture, where it came from, its headline and what to do. */
export function Story({ variant, cover, kicker, title, dek, marks, actions, onOpen }: StoryProps) {
  return (
    <article className={styles.story} data-variant={variant}>
      <div className={styles.storyCover}>{cover}</div>
      <div className={styles.storyText}>
        <div className={styles.kicker}>{kicker}</div>
        <h3 className={styles.headline}>
          <button type="button" className={styles.open} onClick={onOpen}>
            {title}
          </button>
        </h3>
        {dek ? <p className={styles.dek}>{dek}</p> : null}
        {marks && marks.length > 0 ? (
          <ul className={styles.marks}>
            {marks.map((mark, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: the marks of a story keep their order
              <li key={index}>{mark}</li>
            ))}
          </ul>
        ) : null}
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </article>
  );
}

/** The top of the front page: the lead story with a rail beside it. */
export function FrontTop({ lead, rail }: { lead: ReactNode; rail: ReactNode }) {
  return (
    <div className={styles.top}>
      <div className={styles.topLead}>{lead}</div>
      <div className={styles.rail}>{rail}</div>
    </div>
  );
}

/** The front page itself: it measures its own width, so its rows fold with the room it has. */
export function FrontPage({ children }: { children: ReactNode }) {
  return <div className={styles.page}>{children}</div>;
}

/** Sections side by side, as the desks of a portal: each one a column that folds under the last. */
export function FrontDesks({ children }: { children: ReactNode }) {
  return <div className={styles.desks}>{children}</div>;
}

type SectionProps = {
  title: string;
  icon?: LucideIcon;
  /** A few quiet words beside the name: how many stories. */
  meta?: string;
  /** A way to see everything of the section. */
  action?: ReactNode;
  /** How the stories sit: cards side by side, or one under the other. */
  layout?: "cards" | "wide" | "list" | "stack";
  children: ReactNode;
};

/** One section of the front page: its name and its stories. */
export function FrontSection({
  title,
  icon: Icon,
  meta,
  action,
  layout = "cards",
  children,
}: SectionProps) {
  return (
    <section className={styles.section} aria-label={title}>
      <div className={styles.sectionHead}>
        {Icon ? <Icon aria-hidden="true" /> : null}
        <h2 className={styles.sectionTitle}>{title}</h2>
        <span className={styles.sectionMeta}>{meta}</span>
        {action}
      </div>
      <div className={styles.sectionBody} data-layout={layout}>
        {children}
      </div>
    </section>
  );
}

/** One line of a feed: when, the headline and who published. */
export type FeedLine = {
  id: string;
  /** The hour of today, or the day: "09:50", "ontem". */
  when: string;
  title: string;
  meta: string;
  /** A rank in front of the line, for a list that ranks: "1". */
  rank?: number;
};

type FeedProps = {
  label: string;
  lines: FeedLine[];
  onOpen: (id: string) => void;
};

/** A feed of headlines, one under the other, as a portal lists its newest stories. */
export function Feed({ label, lines, onOpen }: FeedProps) {
  return (
    <ol className={styles.feed} aria-label={label}>
      {lines.map((line) => (
        <li key={line.id} className={styles.feedLine}>
          <span className={styles.feedWhen} data-rank={line.rank ? "" : undefined}>
            {line.rank ?? line.when}
          </span>
          <span className={styles.feedText}>
            <button type="button" className={styles.feedTitle} onClick={() => onOpen(line.id)}>
              {line.title}
            </button>
            <span className={styles.feedMeta}>{line.meta}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** An outlet as the strip shows it. */
export type StripOutlet = { name: string; letters: string; detail: string; pressed: boolean };

type StripProps = {
  label: string;
  outlets: StripOutlet[];
  /** Narrows the page to one outlet; the same one again lifts the cut. */
  onPick: (name: string) => void;
};

/** The outlets of the radar side by side, each with its mark: a click reads only that one. */
export function OutletStrip({ label, outlets, onPick }: StripProps) {
  return (
    <ul className={styles.strip} aria-label={label}>
      {outlets.map((outlet) => (
        <li key={outlet.name}>
          <button
            type="button"
            className={styles.outlet}
            aria-pressed={outlet.pressed}
            onClick={() => onPick(outlet.name)}
          >
            <OutletMark letters={outlet.letters} name={outlet.name} size="sm" />
            <span className={styles.outletText}>
              <span className={styles.outletName}>{outlet.name}</span>
              <span className={styles.outletDetail}>{outlet.detail}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

type BarsProps = {
  /** What the bars count, for who does not see them: "Notícias por dia, últimos 7 dias: 0, 2, 1". */
  label: string;
  /** One count for each day, the oldest first. */
  days: number[];
};

/** A week in small bars: how much arrived on each day, the tallest one filling the height. */
export function DayBars({ label, days }: BarsProps) {
  const top = Math.max(1, ...days);
  return (
    <span className={styles.bars} role="img" aria-label={label}>
      {days.map((count, index) => (
        <i
          // biome-ignore lint/suspicious/noArrayIndexKey: the days of a week keep their order
          key={index}
          className={styles.bar}
          data-empty={count === 0 ? "" : undefined}
          style={{ height: `${Math.max(8, (count / top) * 100)}%` }}
        />
      ))}
    </span>
  );
}

type SourceProps = {
  /** The mark of the source, where a logo would be. */
  mark: ReactNode;
  title: string;
  /** What it is and where it reads from: "Feed · noticias.example.test". */
  detail: string;
  /** Whether it is reading, stopped or failing. */
  state: ReactNode;
  /** What it brought on each of the last days. */
  bars: ReactNode;
  /** A few facts in a line: how much it brought, when it last ran. */
  facts: { label: string; value: string }[];
  /** The newest stories it brought, small, side by side. */
  pictures?: ReactNode;
  /** What went wrong the last time, in plain words. */
  problem?: string;
  /** What to do with it, at the end of its name. */
  actions?: ReactNode;
  /** A way to what it brought, at the foot. */
  foot?: ReactNode;
  /** Stopped: the card keeps its place and loses its weight. */
  muted?: boolean;
};

/**
 * One source of the radar as a card: a search by words, the feed of an outlet or a site. Its
 * mark and name, whether it is reading, the week in bars, what it brought and the newest stories
 * as small pictures.
 */
export function SourceCard({
  mark,
  title,
  detail,
  state,
  bars,
  facts,
  pictures,
  problem,
  actions,
  foot,
  muted,
}: SourceProps) {
  return (
    <li className={styles.source} data-muted={muted ? "" : undefined}>
      <div className={styles.sourceHead}>
        {mark}
        <div className={styles.sourceNames}>
          <h3 className={styles.sourceTitle}>{title}</h3>
          <span className={styles.sourceDetail}>{detail}</span>
        </div>
        {actions ? <div className={styles.sourceActions}>{actions}</div> : null}
      </div>
      <div className={styles.sourceState}>{state}</div>
      <div className={styles.sourceWeek}>
        {bars}
        <dl className={styles.sourceFacts}>
          {facts.map((fact) => (
            <div key={fact.label} className={styles.sourceFact}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {problem ? <p className={styles.sourceProblem}>{problem}</p> : null}
      {pictures ? <div className={styles.sourcePictures}>{pictures}</div> : null}
      {foot ? <div className={styles.sourceFoot}>{foot}</div> : null}
    </li>
  );
}

/** The sources of the radar side by side. */
export function SourceGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className={styles.sources} aria-label={label}>
      {children}
    </ul>
  );
}
