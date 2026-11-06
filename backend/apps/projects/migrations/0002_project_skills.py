"""Les technologies d'un projet deviennent ses compétences (apps.skills).

Les associations existantes sont reprises par nom (sans tenir compte de la casse) ; une technologie
sans compétence du même nom est signalée et non reprise. Les technologies restent utilisées par les expériences.
"""
from django.db import migrations, models


def technologies_to_skills(apps, schema_editor):
    Project = apps.get_model("projects", "Project")
    Skill = apps.get_model("skills", "Skill")
    skills = {}
    for skill in Skill.objects.order_by("display_order", "id"):
        skills.setdefault(skill.name.strip().lower(), skill)
    for project in Project.objects.prefetch_related("technologies"):
        matched = []
        for technology in project.technologies.all():
            skill = skills.get(technology.name.strip().lower())
            if skill is None:
                print(f"\n  [projects.0002] « {technology.name} » (projet {project.slug}) : aucune compétence de ce nom, non reprise.")
            else:
                matched.append(skill)
        project.skills.set(matched)


def skills_to_technologies(apps, schema_editor):
    Project = apps.get_model("projects", "Project")
    Technology = apps.get_model("projects", "Technology")
    from django.utils.text import slugify

    for project in Project.objects.prefetch_related("skills"):
        techs = []
        for skill in project.skills.all():
            tech = Technology.objects.filter(name__iexact=skill.name).first()
            if tech is None:
                tech = Technology.objects.create(name=skill.name[:60], slug=slugify(skill.name)[:60] or f"skill-{skill.pk}")
            techs.append(tech)
        project.technologies.set(techs)


class Migration(migrations.Migration):
    dependencies = [
        ("projects", "0001_initial"),
        ("skills", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="skills",
            field=models.ManyToManyField(blank=True, related_name="projects", to="skills.skill"),
        ),
        migrations.RunPython(technologies_to_skills, skills_to_technologies),
        migrations.RemoveField(model_name="project", name="technologies"),
    ]
