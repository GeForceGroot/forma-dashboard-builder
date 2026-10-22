<?php

declare(strict_types=1);

final class LayoutValidator
{
    public static function validate(mixed $layout): array
    {
        self::check(is_array($layout), 'Layout must be an object.');
        self::number($layout, 'width', 320, 2400);
        self::number($layout, 'height', 320, 5000);
        self::color($layout['background'] ?? null);
        self::check(isset($layout['elements']) && is_array($layout['elements']) && array_is_list($layout['elements']) && count($layout['elements']) <= 150, 'Use at most 150 elements.');
        $ids = [];
        foreach ($layout['elements'] as $item) {
            self::check(is_array($item), 'Invalid element.');
            $id = $item['id'] ?? null;
            self::check(is_string($id) && preg_match('/^[a-zA-Z0-9-]{1,80}$/D', $id) === 1 && !isset($ids[$id]), 'Element IDs must be unique.');
            self::check(in_array($item['type'] ?? '', ['section', 'text', 'image', 'bar', 'line'], true), 'Unknown element type.');
            self::check(is_string($item['name'] ?? null) && strlen($item['name']) <= 120, 'Invalid element name.');
            foreach (['x', 'y'] as $key) self::number($item, $key, 0, 5000);
            self::number($item, 'width', 100, 2400);
            self::number($item, 'height', 60, 5000);
            self::number($item, 'fontSize', 10, 96);
            self::number($item, 'radius', 0, 100);
            self::color($item['background'] ?? null);
            self::color($item['color'] ?? null);
            self::check(array_key_exists('parentId', $item) && ($item['parentId'] === null || is_string($item['parentId'])), 'Invalid parent.');
            $content = $item['content'] ?? null;
            self::check(is_array($content), 'Invalid content.');
            if ($item['type'] === 'text') {
                $runs = $content['runs'] ?? null;
                self::check(is_array($runs) && array_is_list($runs) && count($runs) <= 1000, 'Invalid text runs.');
                $length = 0;
                foreach ($runs as $run) {
                    self::check(is_array($run) && is_string($run['text'] ?? null) && is_bool($run['bold'] ?? null) && is_bool($run['italic'] ?? null), 'Invalid text formatting.');
                    $length += strlen($run['text']);
                }
                self::check($length <= 20000, 'Text is too long.');
            }
            if ($item['type'] === 'image') {
                $source = $content['src'] ?? null;
                self::check(is_string($source), 'Invalid image.');
                if ($source !== '' && $source !== 'assets/landscape.svg') {
                    self::check(preg_match('#^data:image/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$#D', $source, $matches) === 1, 'Only embedded raster images are allowed.');
                    $bytes = base64_decode($matches[2], true);
                    self::check($bytes !== false && strlen($bytes) <= 2 * 1024 * 1024, 'Image must be under 2 MB.');
                    $info = @getimagesizefromstring($bytes);
                    self::check($info !== false && $info['mime'] === 'image/' . $matches[1] && $info[0] <= 10000 && $info[1] <= 10000, 'Invalid image data or dimensions.');
                }
                self::check(is_string($content['alt'] ?? null) && strlen($content['alt']) <= 500, 'Invalid image description.');
                self::check(in_array($content['fit'] ?? '', ['cover', 'contain'], true), 'Invalid image fit.');
            }
            if (in_array($item['type'], ['bar', 'line'], true)) {
                self::check(is_string($content['title'] ?? null) && strlen($content['title']) <= 120, 'Invalid chart title.');
                $labels = $content['labels'] ?? null;
                $values = $content['values'] ?? null;
                self::check(is_array($labels) && is_array($values) && array_is_list($labels) && array_is_list($values) && count($labels) === count($values) && count($values) >= 2 && count($values) <= 24, 'Charts need 2–24 matching labels and values.');
                foreach ($labels as $label) self::check(is_string($label) && strlen($label) <= 30, 'Invalid chart label.');
                foreach ($values as $value) self::check((is_int($value) || is_float($value)) && is_finite((float)$value) && $value >= 0 && $value <= 1000000, 'Chart values must be between 0 and 1,000,000.');
                self::color($content['accent'] ?? null);
            }
            $ids[$id] = $item;
        }
        foreach ($ids as $item) {
            $parent = $layout;
            if ($item['parentId'] !== null) {
                $parent = $ids[$item['parentId']] ?? null;
                self::check($parent !== null && $parent['type'] === 'section' && $parent['parentId'] === null && $item['type'] !== 'section', 'Sections must be top-level containers.');
            }
            self::check($item['x'] + $item['width'] <= $parent['width'] + 0.1 && $item['y'] + $item['height'] <= $parent['height'] + 0.1, 'Element exceeds its container.');
        }
        return $layout;
    }

    private static function number(array $item, string $key, int $min, int $max): void
    {
        $value = $item[$key] ?? null;
        self::check((is_int($value) || is_float($value)) && is_finite((float)$value) && $value >= $min && $value <= $max, "Invalid $key.");
    }

    private static function color(mixed $value): void
    {
        self::check(is_string($value) && preg_match('/^#[0-9a-fA-F]{6}$/D', $value) === 1, 'Invalid color.');
    }

    private static function check(bool $condition, string $message): void
    {
        if (!$condition) throw new InvalidArgumentException($message);
    }
}
