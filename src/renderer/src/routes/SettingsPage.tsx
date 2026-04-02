import { FlaskConical, Save } from 'lucide-react'

type SettingsPageProps = {
  rpcClientId: string
  rpcStatusText: string
  onRpcClientIdChange: (value: string) => void
  onSaveRpc: () => void
  onTestRpc: () => void
}

function SettingsPage({
  rpcClientId,
  rpcStatusText,
  onRpcClientIdChange,
  onSaveRpc,
  onTestRpc
}: SettingsPageProps): React.JSX.Element {
  return (
    <section className="content-panel settings-panel">
      <h2>Settings</h2>
      <p className="settings-section-title">Discord RPC</p>
      <input
        value={rpcClientId}
        onChange={(event) => onRpcClientIdChange(event.target.value)}
        placeholder="Discord Client ID"
      />
      <button className="icon-only-btn" title="Save RPC settings" onClick={onSaveRpc}>
        <Save className="icon" />
      </button>
      <button className="icon-only-btn" title="Send test RPC" onClick={onTestRpc}>
        <FlaskConical className="icon" />
      </button>
      <p className="rpc-status">{rpcStatusText}</p>
    </section>
  )
}

export default SettingsPage
