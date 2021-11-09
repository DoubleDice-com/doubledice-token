export function zipArrays2<A, B>(aaa: A[], bbb: B[]): [A, B][] {
  if (aaa.length === 0 || bbb.length === 0) {
    return [];
  } else {
    const [[a, ...aa], [b, ...bb]] = [aaa, bbb];
    return [[a, b], ...zipArrays2(aa, bb)];
  }
}

export function zipArrays3<A, B, C>(aaa: A[], bbb: B[], ccc: C[]): [A, B, C][] {
  return zipArrays2(aaa, zipArrays2(bbb, ccc)).map(([a, [b, c]]) => [a, b, c]);
}

export function zipArrays5<A, B, C, D, E>(aaa: A[], bbb: B[], ccc: C[], ddd: D[], eee: E[]): [A, B, C, D, E][] {
  return zipArrays2(aaa, zipArrays2(bbb, zipArrays2(ccc, zipArrays2(ddd, eee)))).map(([a, [b, [c, [d, e]]]]) => [a, b, c, d, e]);
}

export function unzipArrays2<A, B>(ababab: [A, B][]): [A[], B[]] {
  if (ababab.length === 0) {
    return [[], []];
  } else {
    const [[a, b], ...abab] = ababab;
    const [aa, bb] = unzipArrays2(abab);
    return [[a, ...aa], [b, ...bb]];
  }
}
