import styles from "./growth-map.module.css";

/** One day of the map: its date and how much happened on it. */
export type MapDay = { day: string; count: number };

type Props = {
  /** What the map shows, for a screen reader. */
  label: string;
  /** The weeks, the oldest first, each with its seven days from Sunday. */
  weeks: MapDay[][];
  /** The day of today: the days after it are still to come. */
  today: string;
  /** What is counted, one and many: "ficha aprovada", "fichas aprovadas". */
  noun: [one: string, many: string];
};

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const WEEKDAYS = ["", "seg", "", "qua", "", "sex", ""];
/** Where there is little room only the newest weeks show: the older ones give way. */
const NEAR_WEEKS = 13;

/** The shade of a day: nothing, a little, some, much, the most of the period. */
function levelOf(count: number, most: number): number {
  if (count === 0) return 0;
  return Math.max(1, Math.ceil((count / most) * 4));
}

/**
 * The growth of something day by day over some weeks, as small squares: darker where more
 * happened. Under it, how much the whole period adds up to.
 */
export function GrowthMap({ label, weeks, today, noun }: Props) {
  const days = weeks.flat();
  const most = Math.max(1, ...days.map((entry) => entry.count));
  const total = days.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <div className={styles.map}>
      <div
        className={styles.grid}
        role="img"
        aria-label={`${label}: ${total} ${total === 1 ? noun[0] : noun[1]} em ${weeks.length} semanas`}
      >
        <span className={styles.month} />
        {WEEKDAYS.map((name, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: the days of the week never reorder
          <span key={index} className={styles.weekday} aria-hidden="true">
            {name}
          </span>
        ))}
        {weeks.map((week, index) => {
          const first = week[0]?.day ?? "";
          const before = weeks[index - 1]?.[0]?.day;
          // The name of a month stands over the first week that starts in it; the first week of
          // the map only says its month when the month starts there.
          const starts = before
            ? first.slice(5, 7) !== before.slice(5, 7)
            : +first.slice(8, 10) <= 7;
          const far = weeks.length - index > NEAR_WEEKS ? "" : undefined;
          return [
            <span key={`${first}-month`} className={styles.month} data-far={far} aria-hidden="true">
              {starts ? MONTHS[+first.slice(5, 7) - 1] : ""}
            </span>,
            ...week.map((entry) => (
              <span
                key={entry.day}
                className={styles.day}
                data-far={far}
                data-level={levelOf(entry.count, most)}
                data-ahead={entry.day > today ? "" : undefined}
                title={`${entry.day.slice(8, 10)}/${entry.day.slice(5, 7)}: ${entry.count} ${entry.count === 1 ? noun[0] : noun[1]}`}
              />
            )),
          ];
        })}
      </div>
      <div className={styles.foot}>
        <span className={styles.total}>
          {total} {total === 1 ? noun[0] : noun[1]} em {weeks.length} semanas
        </span>
        <span className={styles.scale} aria-hidden="true">
          menos
          <span className={styles.day} data-level="0" />
          <span className={styles.day} data-level="1" />
          <span className={styles.day} data-level="2" />
          <span className={styles.day} data-level="3" />
          <span className={styles.day} data-level="4" />
          mais
        </span>
      </div>
    </div>
  );
}
