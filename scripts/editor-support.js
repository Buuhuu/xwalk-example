import {
  decorateBlock,
  decorateButtons,
  decorateIcons,
  loadBlock,
} from './lib-franklin.js';

const connectionPrefix = 'urn:aemconnection:';

async function handleEditorUpdate(event) {
  const { detail } = event;

  const resource = detail?.requestData?.target?.resource;
  if (!resource) return;

  const element = document.querySelector(`[data-aue-resource="${resource}"]`);
  const block = element?.parentElement?.closest('.block') || element?.closest('.block');
  const blockResource = block?.getAttribute('data-aue-resource');
  if (!block || !blockResource?.startsWith(connectionPrefix)) return;

  const updates = detail?.responseData?.updates;
  if (updates.length > 0) {
    const { content } = updates[0];
    const newBlockDocument = new DOMParser().parseFromString(content, 'text/html');
    const newBlock = newBlockDocument?.querySelector(`[data-aue-resource="${blockResource}"]`);
    if (newBlock) {
      newBlock.style.display = 'none';
      block.insertAdjacentElement('afterend', newBlock);
      // decorate buttons and icons
      decorateButtons(newBlock);
      decorateIcons(newBlock);
      // decorate and load the block
      decorateBlock(newBlock);
      await loadBlock(newBlock);
      // remove the old block and show the new one
      block.remove();
      newBlock.style.display = null;
    }
  }
}

document.querySelector('main')?.addEventListener('aue:content-patch', handleEditorUpdate);

// group editable texts in single wrappers if applicable
//
// this should work reliably as the script executes after the scripts.js and hence all sections
// should be decorated already.
(function mergeRichtexts() {
  const aueDataAttrs = ['aueBehavior', 'aueProp', 'aueResource', 'aueType', 'aueFilter'];

  function removeInstrumentation(on) {
    aueDataAttrs.forEach((attr) => delete on.dataset[attr]);
  }

  function moveInstrumentation(from, to) {
    aueDataAttrs.forEach((attr) => {
      to.dataset[attr] = from.dataset[attr];
    });
    removeInstrumentation(from);
  }

  // any of initialized, loading or loaded
  const editables = [...document.querySelectorAll('[data-aue-type="richtext"]:not(div)')];
  while (editables.length) {
    const editable = editables.shift();
    // group rich texts
    // eslint-disable-next-line object-curly-newline
    const { aueProp, aueResource } = editable.dataset;
    const container = document.createElement('div');
    moveInstrumentation(editable, container);
    editable.replaceWith(container);
    container.append(editable);
    while (editables.length) {
      const nextEditable = editables.shift();
      // TODO: check if nextEditable is a consecutive sibling of the current editable.
      // should never happane, as AEM renders the paragraphs of a single text component
      // conescutively anyway. however there may be some inference with auto blocking
      // eventually.
      const { aueProp: nextAueProp, aueResource: nextAueResource } = nextEditable.dataset;
      if (aueProp === nextAueProp && nextAueResource === aueResource) {
        removeInstrumentation(nextEditable);
        container.append(nextEditable);
      } else {
        editables.unshift(nextEditable);
        break;
      }
    }
  }
}());
