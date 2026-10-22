<?php

declare(strict_types=1);

final class DashboardRepository
{
    public function __construct(private PDO $db) {}

    public function find(int $id): ?array
    {
        $query = $this->db->prepare('SELECT id, name, layout, version, updated_at FROM dashboards WHERE id = :id');
        $query->execute(['id' => $id]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        if (!$row) return null;
        $row['id'] = (int)$row['id'];
        $row['version'] = (int)$row['version'];
        $row['layout'] = json_decode($row['layout'], true, 512, JSON_THROW_ON_ERROR);
        return $row;
    }

    public function save(int $id, string $name, array $layout, int $version): ?array
    {
        $this->db->beginTransaction();
        try {
            $query = $this->db->prepare('UPDATE dashboards SET name = :name, layout = :layout, version = version + 1 WHERE id = :id AND version = :version');
            $query->execute(['id' => $id, 'name' => $name, 'layout' => json_encode($layout, JSON_THROW_ON_ERROR), 'version' => $version]);
            $result = $query->rowCount() === 1 ? $this->find($id) : null;
            $this->db->commit();
            return $result;
        } catch (Throwable $error) {
            $this->db->rollBack();
            throw $error;
        }
    }
}
