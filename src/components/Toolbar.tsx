import type { StudioSessionMode } from '../studio/sessionTypes';

interface ToolbarProps {
  projectName: string;
  mode: StudioSessionMode;
  hasTake: boolean;
  editEnabled?: boolean;
  playEnabled?: boolean;
  agentEnabled?: boolean;
  importEnabled?: boolean;
  onProjectName(name: string): void;
  onEdit(): void;
  onPlay(): void;
  onReplay(): void;
  onAgent(): void;
  onExportProject(): void;
  onImportProject(file: File): Promise<void>;
}

export function Toolbar({
  projectName,
  mode,
  hasTake,
  editEnabled = true,
  playEnabled = true,
  agentEnabled = true,
  importEnabled = true,
  onProjectName,
  onEdit,
  onPlay,
  onReplay,
  onAgent,
  onExportProject,
  onImportProject,
}: ToolbarProps) {
  const rendering = mode === 'render';
  const recording = mode === 'play';
  const importLocked = rendering || recording || !importEnabled;
  return (
    <header className="toolbar">
      <div className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="brand-copy">
        <strong>Melo Game Creative Studio</strong>
        <input
          value={projectName}
          disabled={rendering || recording}
          onChange={(event) => onProjectName(event.target.value)}
          aria-label="项目名称"
        />
      </div>
      <nav className="mode-tabs" aria-label="工作模式">
        <button
          className={mode === 'edit' ? 'is-active' : ''}
          onClick={onEdit}
          disabled={rendering || !editEnabled}
          title={editEnabled ? undefined : '当前游戏包尚未开放牌面编辑'}
        >编辑</button>
        <button
          className={mode === 'play' ? 'is-active' : ''}
          onClick={onPlay}
          disabled={rendering || recording || !playEnabled}
          title={playEnabled ? undefined : '当前游戏包尚未开放真人试玩录制'}
        >真人试玩</button>
        <button
          className={mode === 'replay' || mode === 'render' ? 'is-active' : ''}
          onClick={onReplay}
          disabled={!hasTake || rendering || recording}
        >导演回放</button>
      </nav>
      <div className="toolbar-actions">
        <button
          className="button-secondary"
          onClick={onAgent}
          disabled={rendering || recording || !agentEnabled}
          title={agentEnabled ? undefined : '当前游戏包使用预制参考 Take'}
        >机器试玩</button>
        <label className={importLocked ? 'button-secondary file-button is-disabled' : 'button-secondary file-button'}>
          导入项目
          <input
            type="file"
            disabled={importLocked}
            accept=".json,.melo.json,application/json"
            onChange={async (event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              try {
                await onImportProject(file);
              } catch (error) {
                window.alert(error instanceof Error ? error.message : '导入失败。');
              } finally {
                event.currentTarget.value = '';
              }
            }}
          />
        </label>
        <button className="button-primary" onClick={onExportProject} disabled={rendering || recording}>导出工程码</button>
      </div>
    </header>
  );
}
