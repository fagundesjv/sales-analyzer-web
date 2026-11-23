import s from "./settings.module.css";

export function SettingsViews({ label, base, current, views }) {
  const selected = views.find(([key]) => key === current)?.[0] ?? views[0][0];
  return (
    <nav className={s.views} aria-label={label}>
      {views.map(([key, title, Icon]) => (
        <a key={key} href={"#" + base + (key ? "/" + key : "")}
          aria-current={selected === key ? "page" : undefined}>
          {Icon && <Icon size={16} aria-hidden="true" />}
          {title}
        </a>
      ))}
    </nav>
  );
}
