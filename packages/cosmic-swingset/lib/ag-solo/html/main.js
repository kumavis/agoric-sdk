/* global WebSocket fetch document window */
const RECONNECT_BACKOFF_SECONDS = 3;
// Functions to run to reset the HTML state to what it was.
const resetFns = [];
let inpBackground;

function run() {
  const disableFns = []; // Functions to run when the input should be disabled.
  resetFns.push(() => (document.querySelector('#history').innerHTML = ''));

  let nextHistNum = 0;
  let inputHistoryNum = 0;

  async function call(req) {
    const res = await fetch('/vat', {
      method: 'POST',
      body: JSON.stringify(req),
      headers: { 'Content-Type': 'application/json' },
    });
    const j = await res.json();
    if (j.ok) {
      return j.res;
    }
    throw new Error(`server error: ${JSON.stringify(j.rej)}`);
  }

  const loc = window.location;
  const protocol = loc.protocol.replace(/^http/, 'ws');
  const socketEndpoint = `${protocol}//${loc.host}/`;
  const ws = new WebSocket(socketEndpoint);

  ws.addEventListener('error', ev => {
    console.log(`ws.error`, ev);
    ws.close();
  });

  ws.addEventListener('close', _ev => {
    for (const fn of disableFns) {
      fn();
    }
    console.log(`Reconnecting in ${RECONNECT_BACKOFF_SECONDS} seconds`);
    setTimeout(run, RECONNECT_BACKOFF_SECONDS * 1000);
  });

  const commands = [];

  function addHistoryRow(h, histnum, kind, value) {
    const row = document.createElement('div');
    row.className = `${kind}-line`;
    const label = document.createElement('div');
    label.textContent = `${kind}[${histnum}]`;
    const content = document.createElement('div');
    content.id = `${kind}-${histnum}`;
    content.textContent = `${value}`;
    row.appendChild(label);
    row.appendChild(content);
    h.append(row);
  }

  function addHistoryEntry(histnum, command, result) {
    const h = document.getElementById('history');
    addHistoryRow(h, histnum, 'command', command);
    addHistoryRow(h, histnum, 'history', result);
    commands[histnum] = command;
  }

  function updateHistory(histnum, command, result) {
    const h = document.getElementById('history');
    const isScrolledToBottom =
      h.scrollHeight - h.clientHeight <= h.scrollTop + 1;
    if (histnum >= nextHistNum) {
      nextHistNum = histnum + 1;
    }
    const c = document.getElementById(`command-${histnum}`);
    if (c) {
      const h1 = document.getElementById(`history-${histnum}`);
      c.textContent = `${command}`;
      h1.textContent = `${result}`;
    } else {
      addHistoryEntry(histnum, command, result);
    }
    if (isScrolledToBottom) {
      setTimeout(() => (h.scrollTop = h.scrollHeight), 0);
    }
  }

  function setNextHistNum(max = 0) {
    const thisHistNum = nextHistNum;
    nextHistNum = Math.max(nextHistNum, max);
    document.getElementById('historyNumber').textContent = nextHistNum;
    inputHistoryNum = nextHistNum;
    commands[inputHistoryNum] = '';
    return thisHistNum;
  }

  function handleMessage(obj) {
    // we receive commands to update result boxes
    if (obj.type === 'updateHistory') {
      // these args come from calls to vat-http.js updateHistorySlot()
      updateHistory(obj.histnum, obj.command, obj.display);
    } else {
      console.log(`unknown WS type in:`, obj);
    }
  }

  // history updates (promises being resolved) are delivered by websocket
  // broadcasts
  ws.addEventListener('message', ev => {
    try {
      // console.log('ws.message:', ev.data);
      const obj = JSON.parse(ev.data);
      handleMessage(obj);
    } catch (e) {
      console.log(`error handling message`, e);
    }
  });

  ws.addEventListener('open', _ev => {
    console.log(`ws.open!`);
    while (resetFns.length > 0) {
      const fn = resetFns.shift();
      try {
        fn();
      } catch (e) {
        console.error(`error resetting`, e);
      }
    }
  });

  const inp = document.getElementById('input');

  function inputHistory(delta) {
    const nextInput = inputHistoryNum + delta;
    if (nextInput < 0 || nextInput >= commands.length) {
      // Do nothing.
      return;
    }
    inputHistoryNum = nextInput;
    inp.value = commands[inputHistoryNum];
  }

  function submitEval() {
    const command = inp.value;
    console.log('submitEval', command);
    const number = setNextHistNum(nextHistNum + 1);
    updateHistory(number, command, `sending for eval`);
    commands[commands.length - 1] = inp.value;
    commands[commands.length] = '';
    inp.value = '';
    call({ type: 'doEval', number, body: command });
  }

  function inputKeyup(ev) {
    switch (ev.key) {
      case 'Enter':
        submitEval();
        return false;

      case 'ArrowUp':
        inputHistory(-1);
        return false;

      case 'ArrowDown':
        inputHistory(+1);
        return false;

      case 'p':
        if (ev.ctrlKey) {
          inputHistory(-1);
          return false;
        }
        break;

      case 'n':
        if (ev.ctrlKey) {
          inputHistory(+1);
          return false;
        }
        break;

      // Do the standard behaviour.
      default:
    }
    commands[commands.length - 1] = inp.value;
    return true;
  }
  inp.addEventListener('keyup', inputKeyup);
  disableFns.push(() => inp.removeEventListener('keyup', inputKeyup));

  if (inpBackground === undefined) {
    inpBackground = inp.style.background;
  }
  disableFns.push(() => (inp.style.background = '#ff0000'));
  resetFns.push(() => (inp.style.background = inpBackground));

  document.getElementById('go').onclick = submitEval;
  disableFns.push(() =>
    document.getElementById('go').setAttribute('disabled', 'disabled'),
  );
  resetFns.push(() =>
    document.getElementById('go').removeAttribute('disabled'),
  );
}

run();

// Display version information, if possible.
const fetches = [];
const fgr = fetch('/git-revision.txt')
  .then(resp => resp.text())
  .then(text => {
    return text.trimRight();
  })
  .catch(e => {
    console.log(`Cannot fetch /git-revision.txt`, e);
    return '';
  });
fetches.push(fgr);

const fpj = fetch('/package.json')
  .then(resp => resp.json())
  .catch(e => {
    console.log('Cannot fetch /package.json', e);
    return {};
  });
fetches.push(fpj);
Promise.all(fetches)
  .then(([rev, pjson]) => {
    const gr = document.getElementById('package_git');
    if (gr) {
      gr.innerText = rev;
    }
    const pn = document.getElementById('package_name');
    if (pn) {
      pn.innerText = pjson.name || 'cosmic-swingset';
    }
    const pv = document.getElementById('package_version');
    if (pv) {
      pv.innerText = pjson.version || 'unknown';
    }
    const pr = document.getElementById('package_repo');
    if (pr) {
      const repo = pjson.repository || 'https://github.com/Agoric/agoric-sdk';
      const cleanRev = rev.replace(/-dirty$/, '');
      const href = rev ? `${repo}/commit/${cleanRev}` : repo;
      pr.setAttribute('href', href);
    }
  })
  .catch(e => console.log(`Error setting package metadata:`, e));
