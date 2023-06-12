export function parseSourceFromNotes(notes: string): { notes: string; source?: string } {
  const matches = notes.match(/([\s\S]*)Source:([\s\S]*)/);
  if (matches) {
    return {
      notes: matches[1].trim().replace(/\s+/g, ' '),
      source: matches[2].trim().replace(/\s+/g, ' '),
    };
  } 
  return { notes };
  
}

if (import.meta.vitest) {
  test('parseSourceFromNotes handles notes field w/ both notes and source', () => {
    expect(
      parseSourceFromNotes(
        `Platicaba Dona Benigna Romero, Opata de Bacadehuachi, que antiguamente “maca” era el nombre de ciertas víboras, que cargaban los pedigüeños, tal vez para llamar la atención, para distinguirse o quizá para tener suerte. Source: Vestigios de la Cultura Opata Rodolfo Rascon`
      ).notes
    ).toBe(
      'Platicaba Dona Benigna Romero, Opata de Bacadehuachi, que antiguamente “maca” era el nombre de ciertas víboras, que cargaban los pedigüeños, tal vez para llamar la atención, para distinguirse o quizá para tener suerte.'
    );

    expect(
      parseSourceFromNotes(
        `Platicaba Dona Benigna Romero, Opata de Bacadehuachi, que antiguamente “maca” era el nombre de ciertas víboras, que cargaban los pedigüeños, tal vez para llamar la atención, para distinguirse o quizá para tener suerte. Source: Vestigios de la Cultura Opata Rodolfo Rascon`
      ).source
    ).toBe('Vestigios de la Cultura Opata Rodolfo Rascon');
  });

  test('parseSourceFromNotes handles whitespace trimming interiorly also', () => {
    expect(
      parseSourceFromNotes(`Se usa a manera de aclaración, o segunda respuesta, cuando seconsidera que la primera no ha sido entendida.
  
      Source:
      Page 228
      Opata-Spanish Dictionary`).source
    ).toBe('Page 228 Opata-Spanish Dictionary');
  });

  test('parseSourceFromNotes handles source only', () => {
    expect(
      parseSourceFromNotes(`Source:
      Page 228
      Opata-Spanish Dictionary`).source
    ).toBe('Page 228 Opata-Spanish Dictionary');
  });

  test('parseSourceFromNotes handles notes w/o a source part', () => {
    expect(
      parseSourceFromNotes(
        `Se usa a manera de aclaración, o segunda respuesta, cuando seconsidera que la primera no ha sido entendida.`
      ).notes
    ).toBe(
      'Se usa a manera de aclaración, o segunda respuesta, cuando seconsidera que la primera no ha sido entendida.'
    );
  });
}
