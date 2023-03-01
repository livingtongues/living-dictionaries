import { semanticDomains } from '../../site/src/lib/mappings/semantic-domains';

export function reverse_semantic_domains_mapping(semantic_domains: string[]): string[] {
  const cleaned_semantic_domains = clean_semantic_domains(semantic_domains);
  const semantic_domain_number = cleaned_semantic_domains.map((semantic_domain) => {
    const sdn = semanticDomains.find((sd) => sd.name === semantic_domain);
    return sdn ? sdn.key : semantic_domain;
  });
  return semantic_domain_number;
}

function clean_semantic_domains(semantic_domains: string[]): string[] {
  const cleaned_semantic_domains = semantic_domains.map((sd) => {
    if (sd.includes('-')) {
      return sd.replace(/ -/g, ',');
    }
    return sd;
  });
  return cleaned_semantic_domains;
}

if (import.meta.vitest) {
  test('cleans semantic domains', () => {
    const semantic_domains = [
      'Motion',
      'Pro-forms',
      'Spirituality and Religion',
      'Humans - Social Relations and Organization',
      'Health - well-being and sickness',
      'Coordinators - Subordinators - Relativizers - Quotatives',
    ];
    expect(clean_semantic_domains(semantic_domains)).toEqual([
      'Motion',
      'Pro-forms',
      'Spirituality and Religion',
      'Humans, Social Relations and Organization',
      'Health, well-being and sickness',
      'Coordinators, Subordinators, Relativizers, Quotatives',
    ]);
  });

  test.each([
    {
      sdn: ['TAM'],
      expected: ['10.2'],
    },
    {
      sdn: ['Universe and the natural world', 'Earth, geology and landscape'],
      expected: ['1', '1.2'],
    },
    {
      sdn: ['Names', 'Emotions', 'Birds', 'Colors', 'Animals'],
      expected: ['4', '3.2', '1.7', '1.6', '1.5'],
    },
    {
      sdn: ['Health - well-being and sickness', 'Earth - geology and landscape'],
      expected: ['2.4', '1.2'],
    },
    {
      sdn: ['2.4', '1.2'],
      expected: ['2.4', '1.2'],
    },
  ])('inverse semantic domains mapping', ({ sdn, expected }) => {
    expect(reverse_semantic_domains_mapping(sdn)).toEqual(expected);
  });
}
