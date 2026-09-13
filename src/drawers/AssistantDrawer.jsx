import Drawer, { DrawerHeader } from '../components/Drawer.jsx';
import ReviewPanel from '../components/ReviewPanel.jsx';

export default function AssistantDrawer({ baseVersion, plan, onClose, savedId }) {
  return <Drawer label="Talk through my plan" onClose={onClose}>
    <DrawerHeader title="Talk through my plan" icon="spark" onClose={onClose} />
    <ReviewPanel key={baseVersion + JSON.stringify(plan)} baseVersion={baseVersion} plan={plan} savedId={savedId} />
  </Drawer>;
}
