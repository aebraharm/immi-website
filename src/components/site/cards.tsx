import { ArrowRight, Check, Globe2, Quote, Star } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type {
  CountrySummary,
  ServiceWithFeatures,
  TeamMemberWithPhoto,
  TestimonialWithMedia,
} from '@/db/queries/types';
import { getServiceIcon } from '@/lib/config/icons';

/**
 * Content cards shared across the site.
 *
 * Each card renders only the fields that exist. A service with no description
 * shows a title and nothing else; a team member with no photo shows initials.
 * Nothing is padded out with invented copy.
 */

/* -------------------------------------------------------------------------- */
/* Service                                                                    */
/* -------------------------------------------------------------------------- */

export function ServiceCard({
  service,
  className,
  headingLevel = 3,
}: {
  service: ServiceWithFeatures;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Icon = getServiceIcon(service.iconName);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col rounded-lg border border-[var(--border-subtle)] bg-white p-6 shadow-e1',
        'transition-[box-shadow,transform,border-color] duration-[var(--duration-base)] ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-e2 motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="grid size-11 place-items-center rounded-md bg-brand-50 text-[var(--brand-primary)] ring-1 ring-brand-100 transition-colors group-hover:bg-brand-100"
      >
        <Icon className="size-5" />
      </span>

      <Heading className="mt-4 text-base font-semibold tracking-tight text-ink">
        <Link href={`/services/${service.slug}`} className="hover:text-[var(--brand-primary)]">
          {service.title}
          {/* Full-card hit area without nesting interactive elements. */}
          <span aria-hidden="true" className="absolute inset-0" />
        </Link>
      </Heading>

      {service.shortDescription ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {service.shortDescription}
        </p>
      ) : null}

      {service.features.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {service.features.slice(0, 3).map((feature) => (
            <li key={feature.id} className="flex gap-2 text-sm text-slate-600">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              <span>{feature.label}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <span className="mt-auto flex items-center gap-1.5 pt-5 text-sm font-semibold text-[var(--brand-primary)]">
        Learn more
        <ArrowRight
          aria-hidden="true"
          className="size-4 transition-transform duration-[var(--duration-fast)] group-hover:translate-x-0.5 motion-reduce:group-hover:translate-x-0"
        />
      </span>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Country / destination                                                      */
/* -------------------------------------------------------------------------- */

export function CountryCard({
  country,
  className,
  headingLevel = 3,
}: {
  country: CountrySummary;
  className?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  return (
    <article
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1',
        'transition-[box-shadow,transform,border-color] duration-[var(--duration-base)] ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:border-accent-200 hover:shadow-e2 motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-sunken)]">
        {country.heroImageUrl ? (
          <Image
            src={country.heroImageUrl}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
        ) : (
          // No uploaded photograph: a neutral pattern, not a stock image.
          <div
            aria-hidden="true"
            className="grid h-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-300"
          >
            <Globe2 className="size-10" />
          </div>
        )}

        {country.flagUrl ? (
          <span className="absolute left-3 top-3 overflow-hidden rounded-sm ring-1 ring-black/10">
            <Image
              src={country.flagUrl}
              alt={`Flag of ${country.name}`}
              width={32}
              height={22}
              className="h-[22px] w-8 object-cover"
            />
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <Heading className="text-base font-semibold tracking-tight text-ink">
            <Link href={`/destinations/${country.slug}`} className="hover:text-[var(--brand-primary)]">
              {country.name}
              <span aria-hidden="true" className="absolute inset-0" />
            </Link>
          </Heading>
          <Badge tone="neutral" className="shrink-0">
            {country.isoCode}
          </Badge>
        </div>

        {country.summary ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
            {country.summary}
          </p>
        ) : (
          <p className="mt-2 text-sm italic text-slate-600">
            Details for this destination have not been published yet.
          </p>
        )}

        <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-[var(--brand-primary)]">
          {country.destinationCount > 0
            ? `${country.destinationCount} programme${country.destinationCount === 1 ? '' : 's'}`
            : 'View destination'}
          <ArrowRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */
/* Testimonial                                                                */
/* -------------------------------------------------------------------------- */

export function TestimonialCard({
  testimonial,
  className,
}: {
  testimonial: TestimonialWithMedia;
  className?: string;
}) {
  const initial = testimonial.clientDisplayName.trim().charAt(0).toUpperCase();

  return (
    <figure
      className={cn(
        'flex h-full flex-col rounded-lg border border-[var(--border-subtle)] bg-white p-6 shadow-e1',
        className,
      )}
    >
      <Quote aria-hidden="true" className="size-6 text-brand-200" />

      <blockquote className="mt-3 flex-1 text-[0.9375rem] leading-relaxed text-slate-700">
        {testimonial.quote}
      </blockquote>

      <figcaption className="mt-5 flex items-center gap-3 border-t border-[var(--border-subtle)] pt-4">
        {testimonial.photoUrl ? (
          <Image
            src={testimonial.photoUrl}
            alt={testimonial.clientDisplayName}
            width={40}
            height={40}
            className="size-10 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-full bg-accent-50 text-sm font-semibold text-accent-700"
          >
            {initial}
          </span>
        )}

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">
            {testimonial.clientDisplayName}
          </p>
          <p className="truncate text-xs text-slate-500">
            {[testimonial.clientCountry, testimonial.serviceCategory]
              .filter(Boolean)
              .join(' · ') || 'Client'}
          </p>
        </div>
      </figcaption>

      {testimonial.playableVideoUrl ? (
        <a
          href={testimonial.playableVideoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-700 hover:underline"
        >
          <Star aria-hidden="true" className="size-3.5" />
          Watch video testimonial
        </a>
      ) : null}
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Team member                                                                */
/* -------------------------------------------------------------------------- */

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export function TeamCard({
  member,
  className,
}: {
  member: TeamMemberWithPhoto;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-white shadow-e1',
        'transition-[box-shadow,transform] duration-[var(--duration-base)] ease-[var(--ease-out-expo)]',
        'hover:-translate-y-0.5 hover:shadow-e2 motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[var(--surface-sunken)]">
        {member.photoUrl ? (
          <Image
            src={member.photoUrl}
            alt={member.fullName}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            className="object-cover transition-transform duration-[var(--duration-slow)] group-hover:scale-[1.03] motion-reduce:group-hover:scale-100"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid h-full place-items-center bg-gradient-to-br from-slate-100 to-slate-200 text-2xl font-semibold text-slate-600"
          >
            {initials(member.fullName)}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold tracking-tight text-ink">
          {member.fullName}
        </h3>
        {member.professionalTitle ? (
          <p className="mt-0.5 text-sm font-medium text-[var(--brand-primary)]">
            {member.professionalTitle}
          </p>
        ) : null}
        {member.department ? (
          <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-600">
            {member.department}
          </p>
        ) : null}
        {member.bioMd ? (
          <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-slate-600">
            {member.bioMd.replace(/[#*_>`]/g, '').slice(0, 240)}
          </p>
        ) : null}
      </div>
    </article>
  );
}
