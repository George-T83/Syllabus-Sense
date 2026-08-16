import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';

describe('Card Component Suite', () => {
  it('renders Card and its children correctly', () => {
    render(<Card>Card Content</Card>);
    expect(screen.getByText('Card Content')).toBeDefined();
  });

  it('merges custom className onto Card correctly', () => {
    const { container } = render(<Card className="custom-class-123">Card Content</Card>);
    const outerDiv = container.firstChild as HTMLElement;
    expect(outerDiv.className).toContain('custom-class-123');
    // Ensure base styling classes are still there
    expect(outerDiv.className).toContain('relative');
    expect(outerDiv.className).toContain('rounded-glass');
  });

  it('toggles interactive/hoverable classes correctly', () => {
    const { container: container1 } = render(<Card interactive>Interactive Card</Card>);
    const outerDiv1 = container1.firstChild as HTMLElement;
    expect(outerDiv1.className).toContain('hover:-translate-y-1');
    expect(outerDiv1.className).toContain('hover:shadow-card-hover');

    const { container: container2 } = render(<Card hoverable>Hoverable Card</Card>);
    const outerDiv2 = container2.firstChild as HTMLElement;
    expect(outerDiv2.className).toContain('hover:-translate-y-1');
    expect(outerDiv2.className).toContain('hover:shadow-card-hover');

    const { container: container3 } = render(<Card>Static Card</Card>);
    const outerDiv3 = container3.firstChild as HTMLElement;
    expect(outerDiv3.className).not.toContain('hover:-translate-y-1');
    expect(outerDiv3.className).not.toContain('hover:shadow-card-hover');
  });

  it('renders the gradient accent bar only when accent is set', () => {
    const { container: withAccent } = render(<Card accent>Accented</Card>);
    expect(withAccent.querySelector('.bg-gradient-brand')).not.toBeNull();

    const { container: withoutAccent } = render(<Card>Plain</Card>);
    expect(withoutAccent.querySelector('.bg-gradient-brand')).toBeNull();
  });

  it('renders sub-components and merges their custom classNames', () => {
    render(
      <Card>
        <CardHeader className="header-custom">
          <CardTitle className="title-custom">Card Title Text</CardTitle>
          <CardDescription className="desc-custom">Card Description Text</CardDescription>
        </CardHeader>
        <CardContent className="content-custom">Card Content Text</CardContent>
        <CardFooter className="footer-custom">Card Footer Text</CardFooter>
      </Card>,
    );

    const header = screen.getByText('Card Title Text').parentElement;
    expect(header).toBeDefined();
    expect(header?.className).toContain('header-custom');
    expect(header?.className).toContain('flex');

    const title = screen.getByText('Card Title Text');
    expect(title.className).toContain('title-custom');
    expect(title.className).toContain('font-semibold');

    const desc = screen.getByText('Card Description Text');
    expect(desc.className).toContain('desc-custom');
    expect(desc.className).toContain('text-muted-foreground');

    const content = screen.getByText('Card Content Text');
    expect(content.className).toContain('content-custom');
    expect(content.className).toContain('p-6');

    const footer = screen.getByText('Card Footer Text');
    expect(footer.className).toContain('footer-custom');
    expect(footer.className).toContain('flex');
  });
});
