import { createInterface } from 'readline';

function askQuestion(query: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => rl.question(query, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

export const pressAnyKey = async (followingAction = 'to continue'): Promise<void> => {
  await askQuestion(`Press any key ${followingAction}... (or Ctrl-C to quit)`);
};
