import {
  Ban,
  Blend,
  Cable,
  Check,
  Folder,
  Globe2,
  Info,
  Lock,
  Search,
  Settings2,
  X,
} from "@liveagent/app/components/icons";
import {
  type AppSettings,
  type WorkspaceProject,
  type WorkspaceResourceSettingsMode,
  workspaceProjectPathKey,
} from "@liveagent/app/lib/settings";
import { useLocale } from "@liveagent/ui/i18n/index";
import { cn } from "@liveagent/ui/lib/shared/utils";
import {
  CLAWHUB_CATEGORY_SLUGS,
  type ClawHubCategorySlug,
  classifyClawHubSkill,
} from "@liveagent/ui/lib/skills/clawHubCategories";
import { isAlwaysEnabledSkillName, type SkillSummary } from "@liveagent/ui/lib/skills/index";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ResourceActivationSwitch } from "../resources/ResourceActivationSwitch";
import { Button } from "../ui/button";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";

type ResourceTab = "skills" | "mcp";
type SkillCategory = "all" | ClawHubCategorySlug;
const WORKSPACE_RESOURCE_MODES = ["inherit", "custom", "off"] as const;
const RESOURCE_TABS = ["skills", "mcp"] as const;

function ResourceStatePill(props: { active: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium",
        props.active
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-border/60 bg-muted/35 text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          props.active ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      {props.label}
    </span>
  );
}

function classifySkill(skill: Pick<SkillSummary, "name" | "description">): ClawHubCategorySlug[] {
  if (isAlwaysEnabledSkillName(skill.name)) return ["other"];
  return classifyClawHubSkill({
    slug: skill.name,
    displayName: skill.name,
    summary: skill.description,
    topics: [],
  });
}

export function WorkspaceResourceSettingsDrawer(props: {
  project: WorkspaceProject;
  settings: AppSettings;
  skills: SkillSummary[];
  onSave: (draft: {
    mode: WorkspaceResourceSettingsMode;
    skillNames: string[];
    mcpServerIds: string[];
  }) => void;
  onClose: () => void;
}) {
  const { project, settings, skills, onSave, onClose } = props;
  const { t } = useLocale();
  const pathKey = workspaceProjectPathKey(project.path);
  const saved = settings.system.workspaceResourceSettings[pathKey];
  const globalSkillNames = useMemo(
    () => new Set(settings.skills.selected),
    [settings.skills.selected],
  );
  const globalMcpIds = useMemo(
    () =>
      new Set(settings.mcp.servers.filter((server) => server.enabled).map((server) => server.id)),
    [settings.mcp.servers],
  );
  const [mode, setMode] = useState<WorkspaceResourceSettingsMode>(saved?.mode ?? "inherit");
  const [skillNames, setSkillNames] = useState<Set<string>>(
    () => new Set(saved?.mode === "custom" ? saved.skillNames : globalSkillNames),
  );
  const [mcpServerIds, setMcpServerIds] = useState<Set<string>>(
    () => new Set(saved?.mode === "custom" ? saved.mcpServerIds : globalMcpIds),
  );
  const [tab, setTab] = useState<ResourceTab>("skills");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SkillCategory>("all");

  const listedSkills = useMemo(() => {
    const rows: Array<{
      skill: Pick<SkillSummary, "name" | "description">;
      missing: boolean;
    }> = skills.map((skill) => ({ skill, missing: false }));
    if (mode !== "custom") return rows;
    const installedNames = new Set(skills.map((skill) => skill.name));
    for (const name of skillNames) {
      if (installedNames.has(name) || isAlwaysEnabledSkillName(name)) continue;
      rows.push({
        skill: { name, description: t("chat.workspaceResourcesMissingSkill") },
        missing: true,
      });
    }
    return rows;
  }, [mode, skillNames, skills, t]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const selectMode = (next: WorkspaceResourceSettingsMode) => {
    if (next === "custom" && mode !== "custom") {
      setSkillNames(new Set(globalSkillNames));
      setMcpServerIds(new Set(globalMcpIds));
    }
    setMode(next);
  };

  const filteredSkills = useMemo(() => {
    const text = query.trim().toLowerCase();
    return listedSkills.filter(({ skill }) => {
      if (text && !`${skill.name}\n${skill.description}`.toLowerCase().includes(text)) return false;
      return category === "all" || classifySkill(skill).includes(category);
    });
  }, [category, listedSkills, query]);

  const filteredMcp = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return settings.mcp.servers;
    return settings.mcp.servers.filter((server) =>
      `${server.id}\n${server.transport}\n${server.command}\n${server.url}`
        .toLowerCase()
        .includes(text),
    );
  }, [query, settings.mcp.servers]);

  const readonly = mode !== "custom";
  const visibleSkillSelection = mode === "inherit" ? globalSkillNames : skillNames;
  const visibleMcpSelection = mode === "inherit" ? globalMcpIds : mcpServerIds;
  const selectedSkillCount = settings.skills.enabled
    ? listedSkills.filter(
        ({ skill }) =>
          isAlwaysEnabledSkillName(skill.name) || visibleSkillSelection.has(skill.name),
      ).length
    : 0;
  const selectedMcpCount = settings.mcp.servers.filter(
    (server) => server.enabled && visibleMcpSelection.has(server.id),
  ).length;
  const modeContent = {
    inherit: {
      icon: Globe2,
      label: t("chat.workspaceResourcesModeInherit"),
      description: t("chat.workspaceResourcesInheritHint"),
    },
    custom: {
      icon: Settings2,
      label: t("chat.workspaceResourcesModeCustom"),
      description: t("chat.workspaceResourcesCustomHint"),
    },
    off: {
      icon: Ban,
      label: t("chat.workspaceResourcesModeOff"),
      description: t("chat.workspaceResourcesOffHint"),
    },
  };
  const modeOptions = WORKSPACE_RESOURCE_MODES.map((value) => ({
    value,
    ...modeContent[value],
  }));
  const currentModeLabel =
    modeOptions.find((option) => option.value === mode)?.label ??
    t("chat.workspaceResourcesModeInherit");
  const skillList =
    filteredSkills.length > 0 ? (
      filteredSkills.map(({ skill, missing }, index) => {
        const alwaysEnabled = isAlwaysEnabledSkillName(skill.name);
        const checked =
          settings.skills.enabled && (alwaysEnabled || visibleSkillSelection.has(skill.name));
        return (
          <div
            key={skill.name}
            className={cn(
              "flex min-h-[68px] items-center gap-3 px-4 py-3 transition-colors",
              index > 0 && "border-t border-border/45",
              mode === "custom" && "hover:bg-muted/20",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium">{skill.name}</span>
                {alwaysEnabled ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    {t("chat.workspaceResourcesBuiltIn")}
                  </span>
                ) : null}
                {missing ? (
                  <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    {t("chat.workspaceResourcesMissing")}
                  </span>
                ) : null}
              </div>
              <div
                className={cn(
                  "mt-0.5 line-clamp-2 text-xs text-muted-foreground",
                  missing && "text-amber-600 dark:text-amber-300",
                )}
              >
                {skill.description}
              </div>
            </div>
            {readonly ? (
              <ResourceStatePill
                active={checked}
                label={
                  checked
                    ? t("chat.workspaceResourcesEnabled")
                    : t("chat.workspaceResourcesDisabled")
                }
              />
            ) : alwaysEnabled ? (
              <ResourceStatePill
                active={settings.skills.enabled}
                label={t("chat.workspaceResourcesAlwaysEnabled")}
              />
            ) : (
              <ResourceActivationSwitch
                checked={checked}
                disabled={!settings.skills.enabled}
                label={skill.name}
                onCheckedChange={(next) => {
                  const value = new Set(skillNames);
                  if (next) value.add(skill.name);
                  else value.delete(skill.name);
                  setSkillNames(value);
                }}
              />
            )}
          </div>
        );
      })
    ) : (
      <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
        <Search className="h-5 w-5 text-muted-foreground/55" />
        <p className="mt-2 text-xs text-muted-foreground">
          {t("chat.workspaceResourcesEmptySkills")}
        </p>
      </div>
    );
  const mcpList =
    filteredMcp.length > 0 ? (
      filteredMcp.map((server, index) => {
        const checked = visibleMcpSelection.has(server.id) && server.enabled;
        return (
          <div
            key={server.id}
            className={cn(
              "flex min-h-[68px] items-center gap-3 px-4 py-3 transition-colors",
              index > 0 && "border-t border-border/45",
              mode === "custom" && "hover:bg-muted/20",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{server.id}</span>
                <span className="rounded border border-border/50 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {server.transport}
                </span>
                {!server.enabled ? (
                  <span className="shrink-0 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-300">
                    {t("chat.workspaceResourcesGloballyDisabled")}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {server.command || server.url || t("mcpHub.statusEmptyDesc")}
              </div>
            </div>
            {readonly ? (
              <ResourceStatePill
                active={checked}
                label={
                  checked
                    ? t("chat.workspaceResourcesEnabled")
                    : t("chat.workspaceResourcesDisabled")
                }
              />
            ) : (
              <ResourceActivationSwitch
                checked={checked}
                disabled={!server.enabled}
                label={server.id}
                onCheckedChange={(next) => {
                  const value = new Set(mcpServerIds);
                  if (next) value.add(server.id);
                  else value.delete(server.id);
                  setMcpServerIds(value);
                }}
              />
            )}
          </div>
        );
      })
    ) : (
      <div className="flex min-h-44 flex-col items-center justify-center px-6 text-center">
        <Cable className="h-5 w-5 text-muted-foreground/55" />
        <p className="mt-2 text-xs text-muted-foreground">{t("chat.workspaceResourcesEmptyMcp")}</p>
      </div>
    );

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        className="skills-drawer-backdrop-enter absolute inset-0 bg-black/35 backdrop-blur-[2px]"
        aria-label={t("window.close")}
        onClick={onClose}
      />
      <aside
        className="skills-drawer-panel-enter relative flex h-full w-full max-w-[760px] flex-col border-l border-border/60 bg-background shadow-2xl"
        aria-labelledby="workspace-resource-settings-title"
      >
        <header className="flex items-start gap-3.5 border-b border-border/60 bg-background px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/35 shadow-sm">
            <Blend className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="workspace-resource-settings-title" className="text-base font-semibold">
              {t("chat.workspaceResourcesTitle")}
            </h2>
            <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <Folder className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate font-medium text-foreground/75">{project.name}</span>
            </div>
            <div
              className="mt-0.5 truncate pl-5 text-[11px] text-muted-foreground/75"
              title={project.path}
            >
              {project.path}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-2 rounded-full"
            onClick={onClose}
            title={t("window.close")}
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="border-b border-border/60 bg-muted/[0.12] px-5 py-4">
          <RadioGroup
            value={mode}
            onValueChange={(value) => selectMode(value as WorkspaceResourceSettingsMode)}
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {modeOptions.map((option) => {
              const ModeIcon = option.icon;
              const active = mode === option.value;
              return (
                <RadioGroupItem
                  key={option.value}
                  value={option.value}
                  render={<button type="button" />}
                  className={cn(
                    "group relative flex min-h-[76px] items-start gap-2.5 rounded-xl border px-3 py-3 text-left transition-all",
                    active
                      ? "border-foreground/20 bg-background shadow-sm ring-1 ring-foreground/5"
                      : "border-border/55 bg-background/55 hover:border-border hover:bg-background",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                      active
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <ModeIcon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-4 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                  {active ? (
                    <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                      <Check className="h-2.5 w-2.5" />
                    </span>
                  ) : null}
                </RadioGroupItem>
              );
            })}
          </RadioGroup>
        </div>

        {mode === "off" ? (
          <div className="flex min-h-0 flex-1 items-center justify-center bg-muted/[0.08] px-6 py-10">
            <div className="flex max-w-sm flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-background shadow-sm">
                <Ban className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-sm font-semibold">
                {t("chat.workspaceResourcesOffStateTitle")}
              </h3>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                {t("chat.workspaceResourcesOffStateDescription")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => selectMode("custom")}
              >
                <Settings2 className="h-3.5 w-3.5" />
                {t("chat.workspaceResourcesSwitchToCustom")}
              </Button>
            </div>
          </div>
        ) : (
          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value !== "skills" && value !== "mcp") return;
              setTab(value);
              setQuery("");
            }}
            className="flex min-h-0 flex-1 flex-col bg-muted/[0.08] px-5 py-4"
          >
            {mode === "inherit" ? (
              <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-border/55 bg-background px-3.5 py-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="min-w-0 flex-1 text-[11px] leading-4 text-muted-foreground">
                  {t("chat.workspaceResourcesInheritNotice")}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0"
                  onClick={() => selectMode("custom")}
                >
                  {t("chat.workspaceResourcesSwitchToCustom")}
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <TabsList className="border border-border/50 bg-muted/20">
                {RESOURCE_TABS.map((value) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-7 gap-1.5 px-3 text-xs data-[active]:ring-1 data-[active]:ring-border/60"
                  >
                    {value === "skills" ? (
                      <Blend className="h-3.5 w-3.5" />
                    ) : (
                      <Cable className="h-3.5 w-3.5" />
                    )}
                    {value === "skills" ? "Skills" : "MCP"}
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground">
                      {value === "skills"
                        ? `${selectedSkillCount}/${listedSkills.length}`
                        : `${selectedMcpCount}/${settings.mcp.servers.length}`}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              <div className="relative min-w-[12rem] flex-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.currentTarget.value)}
                  placeholder={t("chat.workspaceResourcesSearch")}
                  className="h-9 w-full rounded-lg border border-border/60 bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-foreground/10"
                />
              </div>
            </div>

            <TabsContent value="skills" className="flex min-h-0 flex-1 flex-col">
              <ToggleGroup
                value={[category]}
                onValueChange={(values) => {
                  const next = values[0] as SkillCategory | undefined;
                  if (next) setCategory(next);
                }}
                className="-mx-1 mt-2 gap-1.5 overflow-x-auto p-1"
              >
                {(["all", ...CLAWHUB_CATEGORY_SLUGS] as SkillCategory[]).map((value) => (
                  <ToggleGroupItem
                    key={value}
                    value={value}
                    className="h-7 shrink-0 border border-border/50 px-2.5 text-[11px] text-muted-foreground hover:text-foreground data-[pressed]:border-foreground/20 data-[pressed]:bg-foreground/[0.07] data-[pressed]:text-foreground"
                  >
                    {t(`settings.skillsStoreCategory${value[0].toUpperCase()}${value.slice(1)}`)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="overflow-hidden rounded-xl border border-border/55 bg-background shadow-sm">
                  {skillList}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mcp" className="min-h-0 flex-1">
              <div className="mt-3 h-full overflow-y-auto pr-1">
                <div className="overflow-hidden rounded-xl border border-border/55 bg-background shadow-sm">
                  {mcpList}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}

        <footer className="flex items-center justify-between gap-3 border-t border-border/60 bg-background/95 px-5 py-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="shrink-0 rounded-md border border-border/60 bg-muted/25 px-2 py-1 font-medium text-foreground/75">
              {currentModeLabel}
            </span>
            {mode === "custom" ? (
              <span className="truncate">
                {t("chat.workspaceResourcesSelected")
                  .replace("{skills}", String(skillNames.size))
                  .replace("{mcp}", String(mcpServerIds.size))}
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              {t("chat.cancel")}
            </Button>
            <Button
              className="min-w-20"
              onClick={() =>
                onSave({
                  mode,
                  skillNames: [...skillNames],
                  mcpServerIds: [...mcpServerIds],
                })
              }
            >
              {t("workspaceEditor.save")}
            </Button>
          </div>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}
